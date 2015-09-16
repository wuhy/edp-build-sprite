/**
 * @file 工具方法定义
 * @author sparklewhy@gmail.com
 */

var path = require('path');

/**
 * 规范化给定的文件路径
 *
 * @param {string} srcPath 路径
 * @return {string}
 */
exports.normalize = function (srcPath) {
    return path.normalize(srcPath).replace(/\\/g, '/');
};

/**
 * 查找给定的文件路径的文件对象
 *
 * @param {string|Array.<string>} findFilePaths 要查找的文件路径
 * @param {Array.<Object>} sourceFiles 源文件对象列表
 * @param {boolean=} isOutputPath 是否是按输出路径查找，可选，默认原始路径查询
 * @return {?Array.<Object>|?Object}
 */
exports.findFileByPath = function (findFilePaths, sourceFiles, isOutputPath) {
    var isArr = Array.isArray(findFilePaths);
    if (!isArr) {
        findFilePaths = [findFilePaths];
    }

    var foundFiles = [];

    var sourceLen = sourceFiles.length;
    var file;
    var findPath;
    var findKey = isOutputPath ? 'outputPath' : 'path';
    for (var i = 0, len = findFilePaths.length; i < len; i++) {
        findPath = findFilePaths[i];

        for (var k = 0; k < sourceLen; k++) {
            file = sourceFiles[k];
            if (file[findKey] === findPath) {
                foundFiles.push(file);
                break;
            }
        }
    }

    return isArr ? foundFiles : foundFiles[0];
};

/**
 * 获取给定的文件路径在被引用的文件里的相对路径
 *
 * @param {string} referenceFile 引用的文件绝对路径或者跟 relativeFile 相同的参考目录的路径
 * @param {string} fromFile 引用 `referenceFile` 的文件路径，值同上
 * @return {string}
 */
exports.getReferencePath = function (referenceFile, fromFile) {
    var relativePath = path.relative(
        path.dirname(fromFile), path.dirname(referenceFile)
    );
    return path.join(relativePath, path.basename(referenceFile));
};
