# Eleventy Image Pipeline

**NOTE:** this package is deprecated. Please consider using the more robust [Eleventy Image](https://www.npmjs.com/package/@11ty/eleventy-img) instead.

A configurable Eleventy shortcode that builds multiple resolutions of any image.

## Usage

### Installation

`npm install --save-dev @campj/eleventy-image`

### Environment Variables

#### Source prefix

Set the ELEVENTY_IMAGE_SRC_PREFIX environment variable if you'd like to change where your source images are pulled from.<br> \***\*default**: `src/site`

##### Example 1 (default)

with the default settings you'd do

```
{% Image src="/img/someimage.jpg" %}
```

would transform the image located at `./src/site/img/someimage.jpg`. <br>

##### Example 2

**ELEVENTY_IMAGE_SRC_PREFIX=images**

```
{% Image src="/someimage.jpg" %}
```

would transform the image located at `./images/someimage.jpg`.

#### Path prefix

Set the ELEVENTY_PATH_PREFIX environment variable if you'd like to prepend a prefix to your image paths<br> \***\*default**: none

### Adding to Eleventy

in .eleventy.js:

```js
// require
const { Image } = require("@campj/eleventy-image");
module.exports = function (eleventyConfig) {
  // Shortcode
  eleventyConfig.addNunjucksAsyncShortcode("Image", Image);
  //
};
```

### In any nunjucks template file:

#### Use the shortcode:

```
{% Image
    src = "/img/placeholder-1.jpg",
    maxWidths = [200, 500, 768, 1024, 1368]
%}
```

#### Props:

- **src:** path to the image
- **alt:** alt text for the image
- **maxWidths:** array of per-breakpoint widths to resize the image to (default:`[250, 500, 800, 1368]`)
- **useBase64:** boolean - whether to generate a base64 placeholder image (default: `false`)
- **backgroundColor** css color - color to use as a placeholder while the image loads (default: `null`)
- **rootMargin** rootMargin string - to be used in conjunction with [@campj/lazy-image](https://www.npmjs.com/package/@campj/lazy-image) (default:`"400px 300px"`)
- **tag:** html tag to use for the wrapper element (default: `figure`)
- **caption:** if included, will add a `<figcaption>` element with the caption (default: `null`)
- **captionStyle:** will merge with default style for captions if present - defaults are:

  ```js
  {
    position: "absolute",
    display: "block",
    bottom: 0,
    padding: "2px 10px",
    "background-color": "white"
  }
  ```

- **imgProps:** extra properties to apply to the image

\*\* other properties will get applied to the wrapper tag as attributes
