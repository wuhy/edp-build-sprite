/**
 * @file sprite 解析工具方法
 * @author sparklewhy@gmail.com
 */

var _ = require('lodash');
var pathUtil = require('path');
var urlUtil = require('url');
var edp = require('edp-core');
var util = require('./util');

/**
 * 用于提取样式中url属性值里包含的链接
 *
 * @type {RegExp}
 * @const
 */
var CSS_URL_REGEXP = /url\s*\(\s*['"]?\s*([^\s'"\(\)]*)\s*['"]?\s*\)/g;

/**
 * 提取像素比例的正则
 *
 * @type {RegExp}
 * @const
 */
var DPR_REGEXP = /@(\d)x\.\w+$/;

/**
 * 获取图片合并的信息
 *
 * @param {?string} target 要合并的目标文件名
 * @param {string} cssFile 引用该图片的 css 文件路径
 * @param {string} imgFile 要合并的图片文件路径
 * @param {Object} options 合并选项
 * @param {string} options.outputDir 合并的目标目录
 * @return {{dpr: number, target: string}}
 */
function getSpriteTarget(target, cssFile, imgFile, options) {
    var reusult = DPR_REGEXP.exec(imgFile);
    var dpr = reusult && reusult[1];

    var targetFile;
    if (target) {
        targetFile = pathUtil.join(options.outputDir, target);
    }
    else if (options.groupByCSSFile) {
        // 按文件合并
        targetFile = cssFile.replace(/\.\w+$/, '');
    }
    else {
        // 所有 sprite 合成一个文件
        targetFile = pathUtil.join(options.outputDir, 'all');
    }

    dpr = +dpr || 1;
    targetFile += (dpr === 1 ? '' : ('@' + dpr + 'x')) + '.png';

    return {
        dpr: dpr,
        target: targetFile
    };
}

/**
 * 根据给定的图片信息查找要合并的图片
 *
 * @param {Object} imgInfo 图片信息
 * @param {Array.<Object>} imgArr 要合并的图片数组
 * @return {?Object}
 */
function findSpriteImg(imgInfo, imgArr) {
    var foundItem;
    imgArr.some(function (item) {
        if (imgInfo.path === item.path
            && imgInfo.target === item.target) {
            foundItem = item;
            return true;
        }
    });

    return foundItem;
}

/**
 * 获取给定图片 url 要生成的雪碧图的信息，如果文件不存在或者非本地文件，则返回 undefined
 *
 * @param {string} url 图片的 url
 * @param {string} filePath 引用该图片的文件路径
 * @param {Object} options 选项
 * @return {Object}
 */
function getImgSpriteInfo(url, filePath, options) {
    if (!edp.path.isLocalPath(url)) {
        return;
    }

    var urlInfo = urlUtil.parse(util.normalize(
        pathUtil.join(pathUtil.dirname(filePath), url)
    ), true);

    var spriteTarget = urlInfo.query[options.spriteParamName];
    var imgPath = urlInfo.pathname;

    if (!util.findFileByPath(imgPath, options.allFiles)) {
        edp.log.error(
            'The image file %s referred in file %s is not found.',
            imgPath, filePath
        );
        return;
    }

    var targetInfo = getSpriteTarget(spriteTarget, filePath, imgPath, options);
    var fixIE6 = urlInfo.query[options.ie6ParamName];
    return _.extend({
        path: imgPath,
        sprite: spriteTarget !== undefined,
        ie6: fixIE6 === undefined ? options.fixIE6PNG : fixIE6
    }, targetInfo);
}

/**
 * 判断两个给定的 sprite 图片信息是否一样
 *
 * @param {Object} img1 sprite 图片1
 * @param {Object} img2 sprite 图片2
 * @return {boolean}
 */
function isSameSpriteImg(img1, img2) {
    return !['path', 'sprite', 'target', 'ie6'].some(function (k) {
        return img1[k] !== img2[k];
    });
}

/**
 * 解析给定的 css 样式文件的 sprite 信息。
 * 提取的图片信息包含如下信息：
 * {
 *     path: string, // 图片的路径，
 *     sprite: true, // 是否要 sprite
 *
 *     // 要合并到的目标 sprite 文件路径，需要考虑是按文件合并还是根据指定的target，
 *     // 此外需要针对@xx进行区分合并，
 *     target: string,
 *
 *     // 像素比例，如果值不为1，生成的 target 会加上 @xx
 *     dpr: number,
 *
 *     // 是否要针对 ie6 的 png 问题进行修复
 *     ie6: boolean
 * }
 *
 * e.g.,
 * {
 *      "path":"src/common/img/icon_switch-off.png",
 *      "sprite":true,
 *      "target":"src/common/icon", "dpr":1,
 *      "ie6":false
 * }
 * {
 *      "path":"src/common/img/icon_tip-error@2x.png",
 *      "sprite":true,
 *      "target":"src/sprite/tip", "dpr":2,
 *      "ie6":false
 * }
 *
 * @param {Object} file 样式文件
 * @param {Object} options 解析选项
 * @param {Array.<Object>} imgArr 存储解析的图片的信息数组
 * @return {Array.<Object>} 真正需要处理的图片数组
 */
exports.parse = function (file, options, imgArr) {
    var result;
    var existedImgMap = {};
    var spriteImgs = [];

    while (result = CSS_URL_REGEXP.exec(file.data)) {
        var url = result[1];
        var filePath = file.path;
        var imgSpriteInfo = getImgSpriteInfo(url, filePath, options);

        if (!imgSpriteInfo) {
            continue;
        }

        var imgPath = imgSpriteInfo.path;
        var existedImg = existedImgMap[imgPath];
        if (existedImg) {
            // 同一图片在同一样式文件里不允许存在不同合并方式
            isSameSpriteImg(existedImg, imgSpriteInfo)
            || edp.log.error(
                'The same image %s in file %s with different sprite information is not allowed.',
                imgPath, filePath
            );
        }
        else {
            existedImg = findSpriteImg(imgSpriteInfo, imgArr);
            if (existedImg) {
                // 同一图片在不同样式文件被合并到同一 sprite 里必须保持一样的合并信息
                if (!isSameSpriteImg(existedImg, imgSpriteInfo)) {
                    edp.log.error(
                        'The image %s in file %s has different sprite information in other file.',
                        imgPath, filePath
                    );
                }
                imgSpriteInfo = existedImg;
            }
            else {
                imgArr.push(imgSpriteInfo);
            }

            if (imgSpriteInfo.sprite || imgSpriteInfo.ie6) {
                spriteImgs.push(imgSpriteInfo);
            }

            existedImgMap[imgPath] = imgSpriteInfo;
        }
    }

    return spriteImgs;
};

exports.CSS_URL_REGEXP = CSS_URL_REGEXP;

exports.getImgSpriteInfo = getImgSpriteInfo;
