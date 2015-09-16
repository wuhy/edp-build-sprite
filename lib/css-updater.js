/**
 * @file 更新 css 的样式信息
 * @author sparklewhy@gmail.com
 */

var css = require('css');
var edp = require('edp-core');
var spriteParser = require('./sprite-parser');
var util = require('./util');

var CSS_URL_REGEXP = spriteParser.CSS_URL_REGEXP;
// var IMAGESET_REGEXP = /image-set\s*\(\s*url/;
var BACKGROUND_REGEXP = /(background|background\-image)$/;

/**
 * 获取雪碧图的像素比例
 *
 * @param {Object} spriteInfo 雪碧图信息
 * @param {Object} options 选项
 * @return {number}
 */
function getSpriteDpr(spriteInfo, options) {
    var dpr = spriteInfo.dpr;
    return dpr !== 1 ? dpr : Math.max(1, parseInt(1 / options.scale, 10));
}

/**
 * 获取背景位置值
 *
 * @param {number} value 坐标位置值
 * @return {string|numbr}
 */
function getPositionValue(value) {
    if (value) {
        value *= -1;
        value += 'px';
    }

    return value;
}

/**
 * 获取雪碧图的背景位置
 *
 * @param {Object} spriteInfo 雪碧图信息
 * @param {number} dpr 像素比例
 * @return {string}
 */
function getBackgroundPosition(spriteInfo, dpr) {
    var x = spriteInfo.x;
    var y = spriteInfo.y;

    x = Math.round(x / dpr);
    y = Math.round(y / dpr);

    return getPositionValue(x) + ' ' + getPositionValue(y);
}

/**
 * 获取雪碧图样式的背景大小，返回格式为：'200px 100px'
 *
 * @param {Object} spriteSheet sprite 清单
 * @param {number} dpr 像素比例
 * @return {string}
 */
function getBackgroundSize(spriteSheet, dpr) {
    var w = spriteSheet.width;
    var h = spriteSheet.height;

    w = Math.round(w / dpr) + 'px';
    h = Math.round(h / dpr) + 'px';

    return w + ' ' + h;
}

/**
 * 清空指定的样式属性的值
 *
 * @param {Object} rule 样式规则
 * @param {string} propertyName 要清空的样式属性名
 */
function clearStylePropertyValue(rule, propertyName) {
    rule.declarations.forEach(function (item) {
        if ((item.property || '').indexOf(propertyName) !== -1) {
            item.value =  undefined;
        }
    });
}

/**
 * 移除空的样式属性
 *
 * @param {Object} rule 样式规则
 */
function removeEmptyStyleProperty(rule) {
    var declares = rule.declarations;
    for (var i = declares.length - 1; i >= 0; i--) {
        var d = declares[i];
        if (d.value == null) {
            declares.splice(i, 1);
        }
    }
}

/**
 * 重写背景样式
 *
 * @param {Object} rule 样式规则
 * @param {Object} bgImg 要应用的 sprite 背景图
 * @param {Object} options 选项信息
 */
function rewriteBackgroundStyle(rule, bgImg, options) {
    if (rule._updated) {
        return;
    }

    // 添加重写过标识位，避免重复添加更新样式
    rule._updated = true;

    var dpr = getSpriteDpr(bgImg.sprite, options);
    var insertIndex = bgImg.index + 1;
    var insertProperty = 'background-position';

    // 先清除之前的样式值
    clearStylePropertyValue(rule, insertProperty);

    rule.declarations.splice(insertIndex, 0, {
        type: 'declaration',
        property: insertProperty,
        value: getBackgroundPosition(bgImg.sprite, dpr)
    });

    if (dpr !== 1) {
        insertProperty = 'background-size';

        // 先清除之前的样式值
        clearStylePropertyValue(rule, insertProperty);

        rule.declarations.splice(insertIndex + 1, 0, {
            type: 'declaration',
            property: insertProperty,
            value: getBackgroundSize(bgImg.spriteSheet, dpr)
        });
    }

    removeEmptyStyleProperty(rule);
}

/**
 * 根据给定的图片信息查找其对应的 sprite 清单
 *
 * @param {Object} imgInfo 图片信息
 * @param {Array.<Object>} spriteSheets sprite 清单
 * @return {?Object}
 */
function findSpriteSheet(imgInfo, spriteSheets) {
    if (!imgInfo || !imgInfo.sprite) {
        return;
    }

    var foundItem;
    spriteSheets.some(function (item) {
        if (item.path === imgInfo.target) {
            foundItem = item;
            return true;
        }
    });

    return foundItem;
}

/**
 * 判断是否包含多背景 url，包括使用 imageset 情况
 *
 * @param {Object} rule 要判断的样式规则
 * @return {boolean}
 */
function hasMultipleBackgroundURL(rule) {
    var declares = rule.declarations || [];

    for (var i = declares.length - 1; i >= 0; i--) {
        var d = declares[i];
        var property = d.property || '';

        if (!BACKGROUND_REGEXP.test(property)) {
            continue;
        }

        var urlCounter = 0;
        while (CSS_URL_REGEXP.exec(d.value)) {
            urlCounter++;
        }

        if (urlCounter > 1) {
            return true;
        }
    }

    return false;
}

/**
 * 判断给定的规则的背景 repeat 值是否合法，sprite 的图片，不允许设置值为：repeat|repeat-x|repeat-y
 *
 * @param {Object} rule 样式规则
 * @return {boolean}
 */
function isBackgroundRepeatValueValid(rule) {
    var declares = rule.declarations || [];

    var repeatValue;
    for (var i = declares.length - 1; i >= 0; i--) {
        var d = declares[i];
        var property = d.property || '';
        var value = d.value;

        if (property.indexOf('background-repeat') !== -1 || /background$/.test(property)) {
            repeatValue = value;
            break;
        }
    }

    repeatValue && (repeatValue += ' ');
    return !/(\s+repeat|^repeat)(-[xy])?(\s+)/.test(repeatValue || '');
}

/**
 * 查找需要更新 sprite 信息的样式规则声明
 *
 * @param {Object} rule 样式规则
 * @param {string} filePath 样式文件路径
 * @param {Array.<Object>} spriteSheets 生成的雪碧图清单
 * @param {Object} options sprite 选项
 * @return {Array}
 */
function findSpriteRuleDeclarations(rule, filePath, spriteSheets, options) {
    var hasMultiBgUrl = hasMultipleBackgroundURL(rule);
    var isBgRepeatValid = isBackgroundRepeatValueValid(rule);
    var declares = rule.declarations || [];

    // 查找要替换的 sprite 背景图片的样式规则声明
    var spriteDeclares = [];
    for (var i = declares.length - 1; i >= 0; i--) {
        var d = declares[i];
        var property = d.property || '';
        var value = d.value || '';

        var result;
        var valid = true;
        while (result = CSS_URL_REGEXP.exec(value)) {
            if (!valid) {
                continue;
            }

            var url = result[1];
            var spriteInfo = spriteParser.getImgSpriteInfo(url, filePath, options);
            var spriteSheet = findSpriteSheet(spriteInfo, spriteSheets);

            if (!spriteSheet) {
                continue;
            }

            if (hasMultiBgUrl) {
                edp.log.error(
                    'multiple background image url or imageset sprite is not allowed'
                    + ' in file %s: selector %s',
                    filePath, rule.selectors
                );
            }
            else if (!BACKGROUND_REGEXP.test(property)) {
                edp.log.error(
                    'the style property %s sprite in file %s is not allowed',
                    property, filePath
                );
            }
            else if (!isBgRepeatValid) {
                edp.log.error(
                    'background repeat value in selector %s of file %s is not allowed in sprite ',
                    rule.selectors, filePath
                );
            }
            else {
                spriteDeclares.push({
                    index: i,
                    declare: d,
                    sprite: spriteSheet.map[spriteInfo.path],
                    spriteSheet: spriteSheet
                });
                continue;
            }

            valid = false;
        }
    }

    return spriteDeclares;
}

/**
 * 更新样式规则的 sprite 背景样式信息
 *
 * @param {Object} rule 样式规则
 * @param {string} filePath 要更新的样式文件路径
 * @param {Array.<Object>} spriteSheets sprite清单
 * @param {Object} options sprite 选项信息
 */
function updateRuleStyle(rule, filePath, spriteSheets, options) {

    // 查找要替换的 sprite 背景图片的样式规则声明，并更新其背景的 sprite 样式
    var spriteDeclares = findSpriteRuleDeclarations(rule, filePath, spriteSheets, options);
    spriteDeclares.forEach(function (item) {
        var declare = item.declare;
        declare.value = declare.value.replace(CSS_URL_REGEXP, function (match, url) {
            return match.replace(url, util.getReferencePath(item.spriteSheet.path, filePath));
        });
        rewriteBackgroundStyle(rule, item, options);
    });

    // 递归遍历样式规则集
    (rule.rules || []).forEach(function (r) {
        updateRuleStyle(r, filePath, spriteSheets, options);
    });
}


/**
 * 更新 css 引用的 sprite 图片的样式信息
 *
 * @param {Array.<Object>} spriteSheets 生成的 sprite 信息，spritesheet 包含如下信息：
 *        {
 *          path: string,         // sprite 的图片路径
 *          dpr: number,          // sprite 的像素比例
 *          width: number,        // sprite 的宽
 *          height: number,       // sprite 的高
 *          size: number,         // sprite 文件大小，单位字节
 *          data: binary data,    // sprite 的二进制数据
 *          imgs: Array.<Object>, // sprite 包含的图片信息，图片信息见{@link sprite-parser}
 *                                // 此外，还包含 `width`、`height`、`x`、`y` sprite 属性
 *          map: Object,          // 图片 map, key 为图片路径，value 为图片信息
 *        }
 * @param {Array.<FileInfo>} styleFiles 要更新的样式文件
 * @param {Object} options 选项
 */
exports.update = function (spriteSheets, styleFiles, options) {
    styleFiles.forEach(function (file) {
        var filePath = file.path;
        edp.log.info('parse css file %s...', filePath);

        try {
            var ast = css.parse(file.data);
            var rules = ast.stylesheet.rules;
            rules.forEach(function (rule) {
                updateRuleStyle(rule, filePath, spriteSheets, options);
            });

            file.data = css.stringify(ast);
        }
        catch (e) {
            edp.log.error('error parse style %s: %s', filePath, e.stack);
        }
    });
};

