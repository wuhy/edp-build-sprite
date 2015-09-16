/**
 * @file 生成雪碧图
 * @author sparklewhy@gmail.com
 */

var _ = require('lodash');
var spritesmith = require('spritesmith');

/**
 * 根据 sprite 的图片信息进行分组，合并到对应的 sprite 文件。
 * 返回的分组sprite信息，key 为 sprite 的文件路径，value 为该 sprite 包含的要 sprite 图片。
 *
 * @param {Array.<Object>} imgs 要合并的图片
 * @return {Object}
 */
function groupSpriteImgs(imgs) {
    var spriteMap = {};

    imgs.forEach(function (item) {
        if (item.sprite) {
            var spriteFile = item.target;
            var spriteInfo = spriteMap[spriteFile];
            if (!spriteInfo) {
                spriteMap[spriteFile] = spriteInfo = {
                    imgs: [],
                    dpr: item.dpr,
                    path: spriteFile
                };
            }
            spriteInfo.imgs.push(item);
        }
    });

    return spriteMap;
}

/**
 * 获取要 sprite 的图片路径数组
 *
 * @param {Array.<Object>} imgs 要合并的图片信息
 * @return {Array.<string>}
 */
function getSpriteImgPaths(imgs) {
    var imgPaths = [];

    imgs.forEach(function (item, index) {
        imgPaths[index] = item.path;
    });

    return imgPaths;
}

/**
 * 更新图片生成 sprite 后的位置相关信息
 *
 * @param {Object} result sprite 结果信息，key 为原始图片的路径，value 为其大小坐标信息
 * @param {Array.<Object>} imgs 要更新的原始的图片信息
 */
function updateImgSpriteInfo(result, imgs) {
    imgs.forEach(function (item) {
        var path = item.path;
        // 更新原始图片的 sprite 信息
        _.extend(item, result[path]);

        // 替换掉之前的 sprite 信息 为 更新后的图片信息
        result[path] = item;
    });
}

/**
 * 生成 sprite 图片
 *
 * @param {Array.<Object>} imgs 原始图片
 * @param {Object} options 选项
 * @param {Object} options.spriteOpts 合并的选项，见{@see https://github.com/Ensighten/spritesmith}
 * @param {number} options.scale 图片缩放值
 * @param {Function} callback 生成完毕的回调，回调包含两个参数，第一个参数错误对象，
 *                   第二个参数为生成的 sprite 信息数组
 */
exports.generate = function (imgs, options, callback) {
    var spriteMap = groupSpriteImgs(imgs);
    var spritePaths = Object.keys(spriteMap);
    var spriteNum = spritePaths.length;
    var counter = 0;
    var resultArr = [];
    var errStr = '';

    var spriteDone = function (spriteInfo, err, result) {
        var spriteSheet;

        if (err) {
            errStr += '\nGenerate sprite ' + spriteInfo.path + ' error:' + err.toString();
        }
        else {
            updateImgSpriteInfo(result.coordinates, spriteInfo.imgs);
            var rawData = new Buffer(result.image, 'binary');
            spriteSheet = _.extend(spriteInfo, {
                data: rawData, size: rawData.length, map: result.coordinates
            }, result.properties);
        }
        resultArr[counter++] = spriteSheet;

        if (counter === spriteNum) {
            callback(err, resultArr);
        }
    };

    for (var i = 0; i < spriteNum; i++) {
        var path = spritePaths[i];
        var spriteInfo = spriteMap[path];
        var spriteImgPaths = getSpriteImgPaths(spriteInfo.imgs);
        var opts = _.extend({
            src: spriteImgPaths
        }, options.spriteOpts || {});

        // 根据 dpr/scale 值，缩放 间距
        if (spriteInfo.dpr === 1) {
            opts.padding /= options.scale;
        }
        else {
            opts.padding *= spriteInfo.dpr;
        }

        spritesmith(
            opts,
            spriteDone.bind(this, spriteInfo)
        );
    }

    if (!spriteNum) {
        callback(null, []);
    }
};
