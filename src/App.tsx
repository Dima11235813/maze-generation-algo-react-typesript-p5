import React, { useState, ChangeEvent, useEffect } from 'react';
import { SketchPicker, ColorPickerProps, RGBColor } from 'react-color';
import './App.css';
import { MazeGenerator } from './mazeGenComp/MazeGenerator';
import p5 from 'p5'
import { Color } from './utils/colorUtils';
import { GRID_CELL_WIDTH } from './constants/gridConstants';


const App: React.FC = () => {
  let cellWidthKey = "cellWidthKey"
  // const handleColorChangeComplete = (color: any) => {
  //   debugger
  // }
  //SET DEFAULT COLORS FOR MAZE
  const defaultCellColor = new Color(9, 170, 121, 100)
  const defaultBackgroundColor = new Color(145, 101, 100, 100)

  //SET UP CHANGABLE VAR FOR COLOR TO PASS TO GENERATOR
  let cellColor = defaultCellColor
  let backgroundColor = defaultBackgroundColor

  //SET UP HANDLERS FOR COLOR CHANGE
  const handleCellColorChange = (color: any) => {
    const { r, g, b, a } = color.rgb
    cellColor.r = r
    cellColor.g = g
    cellColor.b = b
    // if (a) {
    //   cellColor.a = a
    // }
  }
  const handleBackgroundColorChange = (color: any) => {
    const { r, g, b, a } = color.rgb
    backgroundColor.r = r
    backgroundColor.g = g
    backgroundColor.b = b
    if (a) {
      backgroundColor.a = a
    }
  }

  //get the window dimensions
  let height = window.innerHeight
  let width = window.innerWidth - 23
  //cell width rules
  let minCellWidth = 6
  let maxCellWidth = width / 20
  let cellSize = GRID_CELL_WIDTH
  // let controlsTopPadding = 100
  let cellWidthFromStorage = localStorage.getItem(cellWidthKey)
  if (cellWidthFromStorage) {
    cellSize = parseInt(cellWidthFromStorage, 10)
  } else {

    cellSize = minCellWidth
  }
  let handleCellWidthChange = (event: ChangeEvent<HTMLSelectElement>) => {
    // temp = newWidth
    // newWidth += temp
    // if (newWidth > minCellWidth && newWidth < maxCellWidth) {
    //   cellSize = newWidth
    // } else {
    // }
    let newWidth = parseInt(event.target.value)
    cellSize = newWidth
    localStorage.setItem(cellWidthKey, event.target.value)
    console.log(`New cell width is ${cellSize}`)
  }
  useEffect(() => {
    // Update the document title using the browser API
    var sketch = (p: p5) => {
      // cellSizeSlider = p.createSlider(6, 255, 100)
      // cellSizeSlider.position(width / 2, height + controlsTopPadding)
      // let cellSize = cellSizeSlider.value()
      // if (typeof cellSize === "string") {
      //   cellSize = parseInt(cellSize, 10)
      // }
      new MazeGenerator(
        p,
        width,
        height,
        cellSize,
        cellColor,
        backgroundColor)
    }
    new p5(sketch);
  });
  let interval = 5
  let numberOfOptions = Math.floor((maxCellWidth - minCellWidth) / interval)
  let optionsValue = minCellWidth
  let dropDownForCellWidth = <select onChange={handleCellWidthChange}>
    {
      new Array(numberOfOptions).fill(1).map(item => {
        let valueToUse = optionsValue
        optionsValue += interval
        return <option
          key={valueToUse}
          value={valueToUse}>{valueToUse}</option>
      })
    }
  </select>

  return (
    <div className="App">
      <div className="color-picker">
        <div>Cell Color</div>
        <SketchPicker
          color={defaultCellColor}
          onChange={handleCellColorChange}
        // onChangeComplete={handleColorChangeComplete}
        />
      </div>
      <div className="grid-controls">
        <div>
          {dropDownForCellWidth}
        </div>
      </div>
      <div className="color-picker-2">
        <div>Background Color</div>
        <SketchPicker
          color={defaultBackgroundColor}
          onChange={handleBackgroundColorChange}
        // onChangeComplete={handleColorChangeComplete}
        />
      </div>
    </div>
  );
}

export default App;
