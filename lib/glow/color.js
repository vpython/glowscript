; (function () {
    "use strict";

    var color = {
        red: vec(1, 0, 0),
        green: vec(0, 1, 0),
        blue: vec(0, 0, 1),
        yellow: vec(1, 1, 0),
        orange: vec(1, 0.6, 0),
        cyan: vec(0, 1, 1),
        magenta: vec(1, 0, 1),
        purple: vec(0.4, 0.2, 0.6),
        white: vec(1, 1, 1),
        black: vec(0, 0, 0),
        gray: function (g) { return vec(g, g, g) },
        hsv_to_rgb: function (hsv) { // algorithm from Python colorsys module
            var h = hsv.x
            var s = hsv.y
            var v = hsv.z
            if (s == 0) { return vec(v, v, v) }
            var i = Math.floor(6 * h)
            var f = (6 * h) - i
            var p = v * (1 - s)
            var q = v * (1 - s * f)
            var t = v * (1 - s * (1 - f))
            var i = i % 6
            switch (i) {
                case 0:
                    return vec(v, t, p)
                case 1:
                    return vec(q, v, p)
                case 2:
                    return vec(p, v, t)
                case 3:
                    return vec(p, q, v)
                case 4:
                    return vec(t, p, v)
                case 5:
                    return vec(v, p, q)
                    // other cases are not possible
            }
        },
        rgb_to_hsv: function (rgb) { // algorithm from Python colorsys module
            var r = rgb.x
            var g = rgb.y
            var b = rgb.z
            var maxc = Math.max(r, g, b)
            var minc = Math.min(r, g, b)
            var v = maxc
            if (minc == maxc) { return vec(0, 0, v) }
            var s = (maxc - minc) / maxc
            var rc = (maxc - r) / (maxc - minc)
            var gc = (maxc - g) / (maxc - minc)
            var bc = (maxc - b) / (maxc - minc)
            var h
            if (r == maxc) {
                h = bc - gc
            } else if (g == maxc) {
                h = 2 + rc - bc
            } else {
                h = 4 + gc - rc
            }
            h = (h / 6)
            if (h < 0) h++
            return vec(h, s, v)
        },
        to_html: function (color) {
            var r = Math.floor(255 * color.x)
            var g = Math.floor(255 * color.y)
            var b = Math.floor(255 * color.z)
            return 'rgb(' + r + ',' + g + ',' + b + ')'
        },
        to_html_rgba: function (color, opacity) {
            var r = Math.floor(255 * color.x)
            var g = Math.floor(255 * color.y)
            var b = Math.floor(255 * color.z)
            return 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')'
        }
    }

    var exports = { color: color }
    Export(exports)
})()