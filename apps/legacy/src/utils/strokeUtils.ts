export enum StrokeCapOptions {
    ROUND = 1,
    SQUARE = 2,
    PROJECT = 3,

}
// let strokeCapOptions : HTMLOptionsCollection = new HTMLOptionsCollection()
//   for (const option in StrokeCapOptions) {
//     if (!Number(option)) {
//         console.log(option);
//         let option: HTMLOptionElement = <option value={option}>{option}</option>
//         strokeCapOptions.add(option)
//     }
// }
//   let dropDownForCellWidthForStrokeCap = <select onChange={handleCellWallStrokeCap}>
//     {