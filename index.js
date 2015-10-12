/**
 * @file css auto sprite 处理器
 * @author sparklewhy@gmail.com
 */

/* global AbstractProcessor:false */

var _ = require('lodash');
var pathUtil = require('path');
var FileInfo = require('./lib/file-info');
var spriteParser = require('./lib/sprite-parser');
var spriteGenerator = require('./lib/sprite-generator');
var spriteCssUpdater = require('./lib/css-updater');

/**
 * 要修复的 ie6 目标位置
 *
 * @type {RegExp}
 * @const
 */
var IE6_FIX_TARGET_REGEXP = /\/\/\s*(DD_belatedPNG\.fix\(['"])\$\{([^'"]+)\}(['"]\);)/g;

/**
 * CSS Auto Sprite 处理器
 *
 * @constructor
 * @param {Object} options 初始化参数
 */
function AutoSprite(options) {
    AbstractProcessor.call(this, options);
    this.spriteOpts = _.extend(
        {}, AutoSprite.DEFAULT_OPTIONS.spriteOpts, options.spriteOpts || {}
    );
}

AutoSprite.prototype = Object.create(AbstractProcessor.prototype);
AutoSprite.prototype.constructor = AutoSprite;

AutoSprite.DEFAULT_OPTIONS = {

    /**
     * 处理器名称
     *
     * @const
     * @type {string}
     */
    name: 'AutoSprite',

    /**
     * 要处理的文件
     *
     * @type {Array}
     */
    files: ['*.css'],

    /**
     * sprite 的选项，{@see https://github.com/Ensighten/spritesmith}
     *
     * @type {Object}
     */
    spriteOpts: {
        padding: 2
    },

    /**
     * 标识要合并为 sprite 的图片的 url 查询参数名称，如果指定了参数值，则合并的图片会合并到
     * 该参数值命名的文件，文件存储在 {@link outputDir}
     *
     * @type {string}
     */
    spriteParamName: '_sprite',

    /**
     * 对给定图片进行缩放的比例，只对不带@xx的图片处理
     *
     * @type {number}
     */
    scale: 1,

    /**
     * 输出的 sprite 文件存储的目标目录，
     * 用于指定合并文件名及{@link groupByCSSFile} 值为 `false` 情况下存放的目录
     *
     * @type {string}
     */
    outputDir: 'src/sprite',

    /**
     * 是否按样式文件输出 `sprite` 文件，即一个样式文件对应一个 `sprite` 文件，还是所有样式文件
     * 引用的 `sprite` 合成一个文件，默认 true。如果 `spriteParamName` 指定了参数值，则相同
     * 参数值会合并到 `<dir>/<spriteParamName>.png` 文件，对于 `@2x` 形式图片会根据其倍率
     * 分开处理，分别输出到不同倍率的文件下：`<sprite>@2x.png`
     *
     * @type {boolean}
     */
    groupByCSSFile: true,

    /**
     * 是否修复 ie6 的 png 格式的图片显示问题。如果某个样式引用图片要强制使用或不使用
     * 加上参数 `<ie6ParamName>=0|1`，只处理一倍倍率的图片。
     *
     * @type {boolean}
     */
    fixIE6PNG: false,

    /**
     * IE6 修复方法
     *
     * @param {Object} file 要修改的文件
     * @param {Object} toFixSelectorMap 要修复的选择器 map
     * @return {string}
     */
    ie6Fixer: function (file, toFixSelectorMap) {
        return file.data.replace(IE6_FIX_TARGET_REGEXP, function (match, fixStart, fixStylePath, fixEnd) {
            var toFixedPaths = fixStylePath.split(',');
            var fixSelectors = [];
            for (var i = toFixedPaths.length; i >= 0; i--) {
                var selectors = toFixSelectorMap[toFixedPaths[i]];
                selectors && [].push.apply(fixSelectors, selectors);
            }

            if (fixSelectors.length) {
                return fixStart + fixSelectors.join(',') + fixEnd;
            }
            return '';
        });
    }
};

/**
 * 构建处理前的行为，选择要处理的文件
 *
 * @param {ProcessContext} processContext 构建环境对象
 * @override
 */
AutoSprite.prototype.beforeAll = function (processContext) {
    AbstractProcessor.prototype.beforeAll.apply(this, arguments);

    var files = this.toProcessFiles = this.processFiles;
    // 为了确保处理器只执行一次，这里初始化要处理的文件为一个
    this.processFiles = files.length > 0 ? [files[0]] : [];

    this.allFiles = processContext.getFiles();
};

/**
 * 添加需要修复的 ie6 选择器
 *
 * @param {Object} allFixedSelectorMap 所有要被修复的选择器
 * @param {Object} fixedSelectorMap 要修复的选择器
 */
function addToFixedSelecotors(allFixedSelectorMap, fixedSelectorMap) {
    Object.keys(fixedSelectorMap).forEach(function (path) {
        var existedSelectors = allFixedSelectorMap[path] || [];
        var updatedSelectors = fixedSelectorMap[path];
        for (var i = updatedSelectors.length - 1; i >= 0; i--) {
            var item = updatedSelectors[i];
            if (existedSelectors.indexOf(item) === -1) {
                existedSelectors.push(item);
            }
        }

        allFixedSelectorMap[path] = existedSelectors;
    });
}

/**
 * 修复 ie6 png 问题
 *
 * @param {Object} processor 处理器
 * @param {Array.<Object>} files 要处理的文件列表
 * @param {Object} toFixedSelectorMap 要修复的选择器
 */
function fixIE6PNG(processor, files, toFixedSelectorMap) {
    for (var i = files.length - 1; i >= 0; i--) {
        var f = files[i];
        if (!/^dep\//.test(f.path) && _.isString(f.data)) {
            f.data = processor.ie6Fixer(f, toFixedSelectorMap);
        }
    }
}

/**
 * 构建处理
 *
 * @param {FileInfo} file 文件信息对象
 * @param {ProcessContext} processContext 构建环境对象
 * @param {Function} callback 处理完成回调函数
 */
AutoSprite.prototype.process = function (file, processContext, callback) {
    var me = this;
    var files = me.toProcessFiles;

    // 提取要进行 sprite 的图片信息
    me.processImgs = [];
    for (var i = files.length - 1; i >= 0; i--) {
        var f = files[i];
        var result = spriteParser.parse(f, me, me.processImgs);

        // 删掉不存在需要处理图片的文件
        if (!result.length) {
            files.splice(i, 1);
        }
    }

    // 生成 sprite 图片
    var toFixSelectorMap = {};
    spriteGenerator.generate(me.processImgs, me, function (err, result) {
        if (err) {
            me.log.error('generate sprite image error: %s', err.stack);
        }
        else if (result.length) {
            for (var i = 0, len = result.length; i < len; i++) {
                var item = result[i];
                var path = item.path;

                me.log.info(
                    'generate sprite image: %s with %d images, size: %s - %dKB',
                    path, item.imgs.length,
                    item.width + ' * ' + item.height,
                    Number(item.size / 1024).toFixed(2)
                );
                var file = new FileInfo({
                    data: item.data,
                    extname: pathUtil.extname(path).slice(1),
                    path: path,
                    fullPath: pathUtil.resolve(processContext.baseDir, path)
                });

                processContext.addFile(file);
            }

            // 根据 sprite 结果 更新 css 样式
            addToFixedSelecotors(toFixSelectorMap, spriteCssUpdater.update(result, files, me));

            // 修复 ie6 png 问题
            fixIE6PNG(me, me.allFiles, toFixSelectorMap);
        }

        callback();
    });
};

module.exports = exports = AutoSprite;
