const fs = require("fs");
const path = require("path");
const url = require("url");
const http = require("http");
const https = require("https");
const sharp = require("sharp");
const cliProgress = require("cli-progress");
const imagemin = require("imagemin");
const imageminMozjpeg = require("imagemin-mozjpeg");
const imageminPngquant = require("imagemin-pngquant");
const imageminWebp = require("imagemin-webp");
const sizeOf = require("image-size");

const pathPrefix = process.env.ELEVENTY_PATH_PREFIX || ``;
const srcPrefix = process.env.ELEVENTY_IMAGE_SRC_PREFIX || `src/site`;
console.log("eleventy-image:: path prefix is", pathPrefix);
/** IMAGE CACHE */
// get the info about the image cache from package.json
const pkg = JSON.parse(
  fs.readFileSync(`${process.cwd()}/package.json`, `utf-8`)
);
const pkgConfig = pkg.config || {};

const IS_LOCAL = !process.env.URL;
const IMAGE_CACHE_DIR = IS_LOCAL
  ? `${process.cwd()}/${pkgConfig.imgCacheDir || `.cache`}`
  : path.resolve(`/opt/build/`, `cache`, `eleventy`);

console.log("cache dir is", IMAGE_CACHE_DIR);

// remember if an image is being processed (in case an image is used in multiple areas, don't re-process)
let isProcessing = {};
/** /IMAGE CACHE */

/** IMAGE COMPRESSION */
// image compression defaults
// modifiable by params of the Image shortComponent

const DEFAULTS = {
  quality: 70,
  png: { speed: 1, dithering: 1 },
  jpg: { progressive: true },
};
/* /IMAGE COMPRESSION */

/* IMAGE PROCESSING PROGRESS BAR */
let imageProgressBar;

function _formatter(options, params, payload = { log: true }) {
  const bar = options.barCompleteString.substr(
    0,
    Math.round(params.progress * options.barsize)
  );
  return payload.log
    ? `Processing ${payload.filename} - ${params.value || 0} of ${
        params.total
      } : ${bar}`
    : ``;
}

function _createProgressBar() {
  if (!imageProgressBar) {
    imageProgressBar = new cliProgress.MultiBar(
      {
        format: _formatter,
        clearOnComplete: true,
        hideCursor: true,
      },
      cliProgress.Presets.shades_grey
    );
  }
}

/* /IMAGE PROCESSING PROGRESS BAR */

/* IMAGE PROCESSING */
/**
 * get the format of an image based on its extension
 * @param {*} ext
 */
function _getFormat(ext) {
  if (ext.charAt(0) === `.`) {
    ext = ext.substr(1);
  }
  switch (ext) {
    case `jpg`:
    case `jpeg`:
    case `JPEG`:
      return `jpeg`;
    default:
      return ext;
  }
}

/**
 *
 * @param {String} ext the extension of the file
 * @param {{quality?:Number, speed?:Number, strip?:Number,jpegProgressive?:Boolean}} options
 */
function _getImageminPlugins(ext, options) {
  if (ext.charAt(0) === `.`) {
    ext = ext.substr(1);
  }
  switch (ext) {
    case `png`:
      const opts = {
        quality: [
          (options.quality || DEFAULTS.quality) / 100,
          Math.min(((options.quality || DEFAULTS.quality) + 20) / 100, 1),
        ],
        speed: DEFAULTS.png.speed,
        strip: DEFAULTS.png.strip,
      };
      return imageminPngquant(opts);
    case `jpg`:
    case `jpeg`:
    case `JPEG`:
      return imageminMozjpeg({
        quality: options.quality || DEFAULTS.quality,
        progressive: options.jpegProgressive || DEFAULTS.jpg.progressive,
      });
    case `webp`:
      return imageminWebp({ quality: options.quality || DEFAULTS.quality });
    default:
      return ext;
  }
}

/* /IMAGE PROCESSING */
const SIZES = [
  { w: 250, suffix: `sm` },
  { w: 500, suffix: `md` },
  { w: 800, suffix: `lg` },
  { w: 1368, suffix: `hd` },
];

function _createDirectories() {
  if (!fs.existsSync(IMAGE_CACHE_DIR)) {
    fs.mkdirSync(IMAGE_CACHE_DIR);
  }
  if (!fs.existsSync(path.resolve(process.cwd(), `./dist/img`))) {
    fs.mkdirSync(path.resolve(process.cwd(), `./dist/img`));
  }
  if (!fs.existsSync(path.resolve(process.cwd(), `./dist/img/compressed`))) {
    fs.mkdirSync(path.resolve(process.cwd(), `./dist/img/compressed`));
  }
}

function _copyImageFromCache(sizes, baseName, sourceExtName) {
  for (let i = 0; i < sizes.length; i++) {
    const { suffix } = sizes[i];
    const outputFileNameReg = `${IMAGE_CACHE_DIR}/${baseName}-${suffix}${sourceExtName}`;
    const outputFileNameModern = `${IMAGE_CACHE_DIR}/${baseName}-modern-${suffix}.webp`;
    const distFileNameReg = path.resolve(
      process.cwd(),
      `./dist/img/compressed/${baseName}-${suffix}${sourceExtName}`
    );
    const distFileNameModern = path.resolve(
      process.cwd(),
      `./dist/img/compressed/${baseName}-modern-${suffix}.webp`
    );
    const existsReg = fs.existsSync(outputFileNameReg);
    if (existsReg) {
      const existsDistReg = fs.existsSync(distFileNameModern);
      if (!existsDistReg) {
        fs.copyFileSync(outputFileNameReg, distFileNameReg);
      }
    } else {
      return false;
    }
    const existsModern = fs.existsSync(outputFileNameModern);
    if (existsModern) {
      const existsDistModern = fs.existsSync(distFileNameModern);
      if (!existsDistModern) {
        fs.copyFileSync(outputFileNameModern, distFileNameModern);
      }
    } else {
      return false;
    }
  }
  return true;
}

/**
 *
 * @param {string} src the path to the image
 * @param {*} maxWidths an array of widths for each breakpoint
 * @param {*} compressionProps compression properties to override the defaults
 */
async function makeThumbnails(
  src,
  maxWidths,
  compressionProps = { quality: DEFAULTS.quality }
) {
  // add a prefix slash
  if (src.charAt(0) !== "/") {
    src = `/${src}`;
  }

  // return out if the image is already being processed
  if (isProcessing[src]) {
    return;
  }
  isProcessing[src] = true;

  // make the promises array
  let promises = [];

  // set the compression props (merged with defaults)
  const productionCompressionProps = Object.assign(
    { lossless: true },
    compressionProps
  );

  // create important directories if they don't exist
  _createDirectories();

  // get the actual path to the image
  // (paths with /img/{filename} map to {cwd}/src/site/img/{filename})
  const sourceImagePath = path.resolve(process.cwd(), `./${srcPrefix}${src}`);
  const sourceExtName = path.extname(src);
  const baseName = path.basename(src, path.extname(src));
  const optimizationMethod = sourceExtName === `.png` ? "png" : "jpeg";

  // initialize a sizes array based on the defaults
  let sizes = SIZES.map((s) => s);
  // then replace with user defined size index (passed to the Image shortComp in the maxWidths prop)
  if (maxWidths) {
    maxWidths.forEach((w, idx) => (sizes[idx].w = w));
  }

  // if the image exists in the cache, copy it to the dist folder,
  // otherwise, return false so we know to generate the image thumbnails
  const exists = _copyImageFromCache(sizes, baseName, sourceExtName);

  // finally, process the image
  if (!exists) {
    _createProgressBar();
    let bar;
    let numImages = 0;
    for (let i = 0; i < sizes.length; i++) {
      const { w, suffix } = sizes[i];
      const outputFileNameReg = `${IMAGE_CACHE_DIR}/${baseName}-${suffix}${sourceExtName}`;
      const outputFileNameModern = `${IMAGE_CACHE_DIR}/${baseName}-modern-${suffix}.webp`;
      const distFileNameReg = path.resolve(
        process.cwd(),
        `./dist/img/compressed/${baseName}-${suffix}${sourceExtName}`
      );
      const distFileNameModern = path.resolve(
        process.cwd(),
        `./dist/img/compressed/${baseName}-modern-${suffix}.webp`
      );

      numImages++;
      if (!bar) {
        bar = imageProgressBar.create(1, 0, {
          format: _formatter,
        });
      }
      try {
        bar.setTotal(numImages);
      } catch (e) {}

      const opts = Object.assign(productionCompressionProps, {
        force: _getFormat(sourceExtName),
      });
      promises.push(
        sharp(sourceImagePath)
          .resize(w, null, { withoutEnlargement: true })
          [optimizationMethod](opts)
          .toBuffer()
          .then((sharpBuffer) =>
            imagemin.buffer(sharpBuffer, {
              plugins: [_getImageminPlugins(sourceExtName, opts)],
            })
          )
          .then((imageminBuffer) => {
            fs.writeFileSync(outputFileNameReg, imageminBuffer);
            // move to dist
            if (!fs.existsSync(distFileNameReg)) {
              fs.copyFileSync(outputFileNameReg, distFileNameReg);
            }
            try {
              bar.increment(1, {
                log: true,
                filename: `${baseName}${sourceExtName}`,
              });
            } catch (e) {}
          })
      );

      numImages++;
      if (!bar) {
        bar = imageProgressBar.create(1, 0, {
          format: _formatter,
        });
      }
      try {
        bar.setTotal(numImages);
      } catch (e) {}
      const webpOpts = Object.assign(productionCompressionProps, {
        force: `webp`,
      });
      promises.push(
        sharp(sourceImagePath)
          .resize(w, null, { withoutEnlargement: true })
          .webp(webpOpts)
          .toBuffer()
          .then((sharpBuffer) =>
            imagemin.buffer(sharpBuffer, {
              plugins: [_getImageminPlugins(`webp`, webpOpts)],
            })
          )
          .then((imageminBuffer) => {
            fs.writeFileSync(outputFileNameModern, imageminBuffer);
            if (!fs.existsSync(distFileNameModern)) {
              fs.copyFileSync(outputFileNameModern, distFileNameModern);
            }
            try {
              bar.increment(1, {
                log: true,
                filename: `${baseName}${sourceExtName}`,
              });
            } catch (e) {}
          })
      );
    }
    // wait until all the different versions of the image are complete
    await Promise.all(promises);
    // clean up the progress bar
    if (bar) {
      try {
        bar.stop();
      } catch (e) {}
    }

    // fill the image cache
    isProcessing[src] = false;
    delete isProcessing[src];
    if (Object.keys(isProcessing).length === 0) {
      imageProgressBar.stop();
      imageProgressBar = null;
    }
  }
}

function getSrcSets(src, asDataAttribute = false) {
  const extName = path.extname(src);
  const dirName = `${pathPrefix}${path.dirname(src)}/compressed`;
  const baseName = path.basename(src).replace(extName, "");

  return `<source ${
    asDataAttribute && `data-`
  }srcset='${dirName}/${baseName}-modern-sm.webp 500w, ${dirName}/${baseName}-modern-md.webp 768w, ${dirName}/${baseName}-modern-lg.webp 1024w, ${dirName}/${baseName}-modern-hd.webp 1368w' type='image/webp'><source ${
    asDataAttribute && `data-`
  }srcset='${dirName}/${baseName}-sm${extName} 500w, ${dirName}/${baseName}-md${extName} 768w, ${dirName}/${baseName}-lg${extName}, ${dirName}/${baseName}-hd${extName} 1368w'>`;
}

function downloadImageBuffer(imageUrl) {
  return new Promise((resolve, reject) => {
    let options = url.parse(imageUrl);
    let httpOrHttps = imageUrl.indexOf("https://") >= 0 ? https : http;
    httpOrHttps.get(options, (response) => {
      let chunks = [];
      response
        .on("data", (chunk) => {
          chunks.push(chunk);
        })
        .on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer);
        })
        .on("error", (error) => {
          reject(error);
        });
    });
  });
}

async function getDimensions(src) {
  let sourceImage;
  let dimensions;

  if (src.indexOf(`http`) === 0) {
    sourceImage = await downloadImageBuffer(src);
  } else {
    sourceImage = path.resolve(process.cwd(), `${srcPrefix}${src}`);
  }
  dimensions = sizeOf(sourceImage);
  return dimensions;
}

async function getDefaultImage(src, useBase64 = false) {
  const extName = path.extname(src);
  const dirName = `${path.dirname(src)}/compressed`;
  const baseName = path.basename(src).replace(extName, "");

  let base64Buffer = null;

  if (useBase64) {
    const sourceImagePath = path.resolve(process.cwd(), `${srcPrefix}${src}`);
    base64Buffer = await sharp(sourceImagePath).resize(32).toBuffer();
  }

  return useBase64
    ? `data:image/png;base64,${base64Buffer.toString("base64")}`
    : `${pathPrefix}${dirName}/${baseName}-sm${extName}`;
}

module.exports = {
  getDefaultImage,
  getDimensions,
  getSrcSets,
  makeThumbnails,
};
