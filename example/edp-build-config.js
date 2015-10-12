/**
 * @file config edp-build
 * @author EFE
 */

/* globals LessCompiler, CssCompressor, JsCompressor, PathMapper, AddCopyright, ModuleCompiler, TplMerge */

exports.input = __dirname;

var path = require('path');
exports.output = path.resolve(__dirname, 'output');

// var moduleEntries = 'html,htm,phtml,tpl,vm,js';
// var pageEntries = 'html,htm,phtml,tpl,vm';

exports.getProcessors = function () {
    var lessProcessor = new LessCompiler({
    });
    var cssProcessor = new CssCompressor();
    var moduleProcessor = new ModuleCompiler();
    var jsProcessor = new JsCompressor();
    var AutoSprite = require('edp-build-sprite');
    var cssSpriter = new AutoSprite({
        files: ['src/index/main.css'],
        // files: ['src/mobile/mobile.css'],

        // 按样式文件引用的图片进行分组 sprite，如果要全局合成一个 sprite 文件，这里设为 false
        groupByCSSFile: true,

        // 对给定图片进行缩放的比例，只对不带@xx的图片处理，因此对于不带@xx命名的文件不要混杂着各种像素密度的图片
        scale: 1, // 0.5

        // 修复 ie6 png 问题
        fixIE6PNG: true
    });
    var pathMapperProcessor = new PathMapper();
    var addCopyright = new AddCopyright();

    return {
        'default': [
             moduleProcessor, cssSpriter, pathMapperProcessor
        ],

        'release': [
            lessProcessor, cssProcessor, moduleProcessor,
            jsProcessor, pathMapperProcessor, addCopyright
        ]
    };
};

exports.exclude = [
    'tool',
    'doc',
    'test',
    'module.conf',
    'dep/packages.manifest',
    'dep/*/*/test',
    'dep/*/*/doc',
    'dep/*/*/demo',
    'dep/*/*/tool',
    'dep/*/*/*.md',
    'dep/*/*/package.json',
    'edp-*',
    '.edpproj',
    '.svn',
    '.git',
    '.gitignore',
    '.idea',
    '.project',
    'Desktop.ini',
    'Thumbs.db',
    '.DS_Store',
    '*.tmp',
    '*.bak',
    '*.swp'
];

/* eslint-disable guard-for-in */
exports.injectProcessor = function (processors) {
    for (var key in processors) {
        global[key] = processors[key];
    }
};
