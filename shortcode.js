const {
  makeThumbnails,
  getDimensions,
  getSrcSets,
  getDefaultImage
} = require("./pipeline");

const FADEUP_IMAGE_STYLE = {
  visibility: `hidden`,
  opacity: 0,
  transition: `opacity 0.4s ease-out`
};

function _getContainerStyle(aspect) {
  const aspectPercent = `${aspect * 100}%`;
  return {
    position: `relative`,
    display: `block`,
    width: `100%`,
    height: 0,
    "padding-top": aspectPercent
  };
}

function _getImageStyle() {
  return {
    position: `absolute`,
    top: `0`,
    left: `0`,
    width: `100%`,
    height: `100%`,
    "object-fit": `cover`
  };
}

function _getStyles(obj) {
  let styles = ``;
  const styleKeys = Object.keys(obj);

  if (styleKeys.length > 0) {
    styles = `${styleKeys.map(key => ` ${key}:${obj[key]};`).join("")}`;
  }
  return styles;
}

function _getAttrs(obj) {
  let attrs = ``;
  const attrKeys = Object.keys(obj);

  if (attrKeys.length > 0) {
    attrs = `${attrKeys.map(key => ` ${key}="${obj[key]}"`).join("")}`;
  }
  return attrs;
}

module.exports = async ({
  src = "",
  addThumbmails = true,
  alt = "",
  loading = "lazy",
  maxWidths = null,
  compression = null,
  useBase64 = false,
  tag = "figure",
  imgProps = {},
  style = {},
  backgroundColor = null,
  rootMargin = null,
  ...rest
}) => {
  const isRemoteImage = src.indexOf(`http`) === 0;
  const dimensions = await getDimensions(src);
  const aspect = dimensions.height / dimensions.width;
  const containerStyle = _getContainerStyle(aspect);
  const imageStyle = _getImageStyle();

  if (addThumbmails && !isRemoteImage) {
    await makeThumbnails(src, maxWidths, compression);
  }
  const attrs = _getAttrs(
    Object.assign(
      {
        style: _getStyles(
          Object.assign(
            containerStyle,
            backgroundColor ? { "background-color": backgroundColor } : {},
            style
          )
        )
      },
      rest
    )
  );

  const imgAttrs = _getAttrs(
    Object.assign(
      {
        style: _getStyles(Object.assign(imageStyle, imgProps.style || {}))
      },
      imgProps
    )
  );

  const img2Attrs = _getAttrs(
    Object.assign(
      {
        style: _getStyles(
          Object.assign(imageStyle, imgProps.style || {}, FADEUP_IMAGE_STYLE)
        )
      },
      imgProps
    )
  );

  const imgSrc = isRemoteImage ? src : await getDefaultImage(src, useBase64);
  const altImgSrc = isRemoteImage ? src : await getDefaultImage(src, false);

  return `<${tag} ${attrs}${
    rootMargin ? ` data-rootmargin="${rootMargin}"` : ``
  }>${
    useBase64
      ? `<img src="${imgSrc}" alt="${alt}" loading="auto" width="${dimensions.width}" height="${dimensions.height}" ${imgAttrs}>`
      : ``
  }<picture>
      ${getSrcSets(src, true)}
      ${
        useBase64
          ? `<img onerror="this.onerror-null" data-src="${altImgSrc}" alt="${alt}" loading="${loading}" width="${dimensions.width}" height="${dimensions.height}" ${img2Attrs}>`
          : `<img onerror="this.onerror-null" data-src="${imgSrc}" alt="${alt}" loading="${loading}" width="${dimensions.width}" height="${dimensions.height}" ${img2Attrs}>`
      }
      <noscript>
      <img src="${useBase64 ? altImgSrc : imgSrc}" alt="${alt}" width="${
    dimensions.width
  }" height="${dimensions.height}" ${imgAttrs}></noscript>
      </picture>
      </${tag}>`;
};
