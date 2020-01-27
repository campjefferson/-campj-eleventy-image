# Eleventy Image Pipeline

A configurable Eleventy shortcode that builds multiple resolutions of any image.

## Usage

### Installation

`npm install --save-dev @campj/image`

### Adding to Eleventy

in .eleventy.js:

```js
// require
const { Image } = require("@campj/eleventy-image");
module.exports = function(config) {
  // Shortcode
  config.addNunjucksAsyncShortcode("Image", Image);
  //
};
```

### In any nunjucks template file:

#### Use the shortcode:

```
{% Image
    src = "/img/placeholder-1.jpg",
    pathPrefix= "src/site",
    maxWidths = [200, 500, 768, 1024, 1368]
%}
```

#### Props:

- **src:** path to the image
- **alt:** alt text for the image
- **pathPrefix:** non http(s) src will be resolved to {pathPrefix}/{src} (default:_src/site_)
- **maxWidths:** array of per-breakpoint widths to resize the image to (default:_[250, 500, 800, 1368]_)
- **useBase64:** boolean - whether to generate a base64 placeholder image (default: _false_)
- **backgroundColor** css color - color to use as a placeholder while the image loads (default: _null_)
- **rootMargin** rootMargin string - to be used in conjunction with [@campj/lazy-image]() (default:_"400px 300px"_)
- **tag:** html tag to use for the wrapper element (default: _figure_)
- **imgProps:** extra properties to apply to the image

\*\* other properties will get applied to the wrapper tag as attributes
