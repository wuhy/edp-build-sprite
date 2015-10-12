
edp-build-sprite
========

> EDP Build plugin for CSS auto sprite

edp-build-sprite 是 [edp-build](https://github.com/ecomfe/edp-build) 的一个插件，支持自动根据要合并的图片生成雪碧图，支持 retina 图片处理。

## 如何使用

### Install

```shell
npm install edp-build-sprite
```


### Config

1. 在样式文件里指定要合并的图片

    ```css 
    /* index/main.css */
    #box0 .bookmark-normal {
        /* 可以指定 target，相同的 target 合并到同一 target 文件，未指定按 `groupByCSSFile` 配置来合并 */
        background: url(./img/bookmark.png?_sprite=bookmark) no-repeat;
    }
    
    #box1 .error {
        background: url(../common/img/icon_tip-error.png?_sprite) no-repeat;
    }
    ```
2. 在 edp 构建配置文件里增加处理器配置

    在 `edp-build-config.js` 处理器添加该处理器，处理位置，放在 css 压缩处理器之前：
    
    ```javascript
    var lessProcessor = new LessCompiler({});
    var cssProcessor = new CssCompressor();
    var moduleProcessor = new ModuleCompiler();
    var jsProcessor = new JsCompressor();
    
    var AutoSprite = require('edp-build-sprite');
    var cssSpriter = new AutoSprite({
        files: ['src/index/main.css'],
    
        // 按样式文件引用的图片进行分组 sprite，如果要全局合成一个 sprite 文件，这里设为 false
        // 默认 为 true  
        groupByCSSFile: true,
    
        // 对给定图片进行缩放的比例，只对不带@xx的图片处理，因此对于不带@xx命名的文件不要
        // 混杂着各种像素密度的图片，对于 pc 可以忽略该选项，移动端如果都是统一使用 2 倍像素的图片，
        // 可以将值设为 0.5
        scale: 0.5,
        
        // 修复 ie6 png 问题，默认 false，修复方式，见下面 options 说明
        fixIE6PNG: true
    });
    
    var pathMapperProcessor = new PathMapper();
    var addCopyright = new AddCopyright();
        
    return {
        'default': [
             moduleProcessor, lessProcessor, 
             cssSpriter, pathMapperProcessor
        ],

        'release': [
            lessProcessor, cssSpriter, cssProcessor, moduleProcessor,
            jsProcessor, pathMapperProcessor, addCopyright
        ]
    };  
    ```
    
## Options
    
* files: `Array` 要处理的样式文件，默认所有 `*.css` 文件    

* spriteOpts: `Object` 合并雪碧图的选项

    * padding: `number` 图片间距，默认 `2`
    * 雪碧图的合并使用 [spritesmith](https://github.com/Ensighten/spritesmith) ，更多选项，可以参考官方文档。
    
* spriteParamName: `string` 标识要合并为 sprite 的图片的 url 查询参数名称，默认 `_sprite`。如果指定了参数值，则合并的图片会合并到该参数值命名的文件，文件存储在 `outputDir`
 
* scale: `number` 对给定图片进行缩放的比例，默认值 `1`，只对不带 @xx 的图片处理

* outputDir: `string` 输出的 sprite 文件存储的目标目录，用于指定合并文件名及 `groupByCSSFile` 值为 `false` 情况下存放的目录。默认 `src/sprite`，由于 edp build 时候会替换 `src` 为 `asset`，因此最终输出位置为 `output/asset/sprite` 目录

* groupByCSSFile: `boolean` 是否按样式文件输出 `sprite` 文件，即一个样式文件对应一个 `sprite` 文件，还是所有样式文件引用的 `sprite` 合成一个文件，默认 `true` 
    
    * 如果 `spriteParamName` 指定了参数值，则相同参数值会合并在相同 target 值的文件:  `<outputDir>/<target>.png` 文件；
    * 值为 `true` 情况，合并文件放置在样式文件旁边，文件名同样式名: `<cssFile>.png` ；
    * 值为 `false` 情况，合并文件为: `<outputDir>/all.png` ；
    * 对于 `@2x` 形式图片会根据其倍率分开处理，分别输出到不同倍率的文件下: `<target>@2x.png` 或 `all@2x.png` 或 `<cssFile>@2x.png` 。

* fixIE6PNG: `boolean` 是否修复 ie6 png 问题， 基于 JS 方式，默认 `false`

    `${xx}` 指定要修复的样式文件，可以指定多个文件，以 `逗号` 分隔
    
    ```html
    <!--[if IE 6]>
    <script src="dep/DD_belatedPNG/DD_belatedPNG_0.0.8a.js"></script>
    <script>
        // DD_belatedPNG.fix("${src/index/main.css}");
    </script>
    <![endif]-->
    ```
    
    处理完结果如下：
    
    ```html
     <!--[if IE 6]>
    <script src="dep/DD_belatedPNG/DD_belatedPNG_0.0.8a.js"></script>
    <script>
        DD_belatedPNG.fix("#box4 .retina-2x .btn-off,#box4 .retina-2x .btn-on,#box1 .warn,#box1 .error,#box0 .common2,#box0 .common1,#box0 .to,#box0 .root,#box0 .organize,#box0 .import,#box0 .normal");
    </script>
    <![endif]-->
    ```

* ie6Fixer: `Function` 修复 ie6 png 问题处理器，默认基于 `// DD_belatedPNG.fix("${xx}");` 正则替换，该方法传入两个参数：`file` (要处理的文件), `toFixSelectorMap` (要修复的样式选择器)，返回替换完文件内容

## Reference

* [sprity](https://github.com/sprity/sprity)
* [gulp.spritesmith](https://github.com/twolfson/gulp.spritesmith)
* [grunt-sprite](https://github.com/hellometers/grunt-sprite)
* [grunt-css-sprite](https://github.com/laoshu133/grunt-css-sprite)
* [fis-spriter-csssprites](https://github.com/fex-team/fis-spriter-csssprites)
* [cssgaga](http://www.99css.com/cssgaga/)
* [ispriter](https://github.com/iazrael/ispriter)
* [CssSpriter](https://github.com/quyatong/CssSpriter)
