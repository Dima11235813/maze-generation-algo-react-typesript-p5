import { RegexExecReturnValObj } from "./regexTypes";

export const RGB_COLOR_REGEX = /\((\d+),\s*(\d+),\s*(\d+)(,\s*(\d*.\d*))?\)/;

const COLOR_STRING_DELIMITER = ":"
//Singleton for static class
// export const ColorUtils = function () {
//     return {
//         FromStringToObj : (colorString: string): Color => {
//             let colorStringArray = colorString.split(COLOR_STRING_DELIMITER)
//             let colorToReturn = new Color(
//                 parseInt(colorStringArray[0]),
//                 parseInt(colorStringArray[1]),
//                 parseInt(colorStringArray[2]),
//             )
//             let a = parseInt(colorStringArray[3])
//             //a is optional
//             if (a) {
//                 colorToReturn.a = a
//             }
//             return colorToReturn
//         }
//     }
// }()
//isn't the above syntactic sugar for this
export class ColorUtils {
    public fromStringToObj(colorString: string): Color {
        let colorStringArray = colorString.split(COLOR_STRING_DELIMITER)
        let colorToReturn = new Color(
            parseInt(colorStringArray[0]),
            parseInt(colorStringArray[1]),
            parseInt(colorStringArray[2]),
        )
        let a = parseInt(colorStringArray[3])
        //a is optional
        if (a) {
            colorToReturn.a = a
        }
        return colorToReturn
    }
}

export const invertColors = (color: Color) => {
    return new Color(
        255 - color.r,
        255 - color.g,
        255 - color.b,
    )
}

export class Color {
    // public r?: number;
    // public g?: number;
    // public b?: number;
    // public a?: number;

    // constructor()
    // constructor(colorStr?: string)
    // constructor(r?: string | number, g?: number, b?: number)
    // constructor(public r?: string | number, g?: number, b?: number, a?: number) {
    constructor(
        public r: number,
        public g: number,
        public b: number,
        public a?: number
    ) {
        // if (typeof r === 'string') {
        //     r = r.trim();
        //     if (r.indexOf('#') === 0) {
        //         r = r.substr(r.indexOf('#') + 1);
        //         this.r = parseInt(r.substr(0, 2), 16);
        //         this.g = parseInt(r.substr(2, 2), 16);
        //         this.b = parseInt(r.substr(4, 2), 16);
        //     } else if (r.indexOf('rgb') === 0) {
        //         //https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec
        //         const res = RGB_COLOR_REGEX.exec(r);
        //         if (res) {
        //             this.r = parseInt(res[1], 10);
        //             this.g = parseInt(res[2], 10);
        //             this.b = parseInt(res[3], 10);
        //             this.a = res[5] ? parseFloat(res[5]) : 1;
        //         }
        //     }
        // } else {
        //     this.r = r;
        //     this.g = g;
        //     this.b = b;
        //     this.a = a || 1;
        // }
    }

    toHex() {
        return `
        #${this.r ? this.r.toString(16) : ""}${this.g ? this.g.toString(16) : ""}${this.b ? this.b.toString(16) : ""}
        `
    }

    toRgb() {
        return `rgb(${this.r}, ${this.g}, ${this.b})`;
    }

    toRgba() {
        return `rgba(${this.r}, ${this.g}, ${this.b}, ${this.a})`;

    }
    toString() {
        return `${this.r}${COLOR_STRING_DELIMITER}${this.g}${COLOR_STRING_DELIMITER}${this.b}${COLOR_STRING_DELIMITER}${this.a ? this.a : ""}`
    }
}
