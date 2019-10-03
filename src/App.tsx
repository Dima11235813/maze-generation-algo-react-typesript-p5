import React, { useState, ChangeEvent, useEffect } from 'react';
import { SketchPicker, ColorPickerProps, RGBColor } from 'react-color';
import './App.css';
import { MazeGenerator } from './mazeGenComp/MazeGenerator';
import p5 from 'p5'
import { Color } from './utils/colorUtils';
import { GRID_CELL_WIDTH } from './constants/gridConstants';
import { mazeDefaultsStorageKeys } from './utils/storageUtils';
import { mazeDefaultOptions } from './mazeGenComp/mazeUtils/mazeDefaults';
import { MazeOptions } from './mazeGenComp/mazeUtils/mazeOptions';
import { MazeOptionsSetter } from './mazeGenComp/mazeUtils/mazeOptionsSetter';


const App: React.FC = () => {
  let mazeOptions = new MazeOptions()
  let mazeOptionsSetter = new MazeOptionsSetter(mazeOptions)

  console.log('Maze Options:')
  console.log(mazeOptions)
  debugger

  //SET UP SCENE CLASS _ TODO Move to that - WHERE the maze generator operates
  //get the window dimensions
  let height = window.innerHeight
  let width = window.innerWidth - 23
  //cell width rules
  let minCellWidth = 6
  let maxCellWidth = width / 20
  // let controlsTopPadding = 100

  const rerunMaze = () => {
    //todo instead of reloading clear out the maze and generate a new one
    window.location.reload()
  }

  let handleCellWallStrokeCap = (event: ChangeEvent<HTMLSelectElement>) => {
    let newStrokeCapStyle = event.target.value
    mazeOptions.cellWallStrokeCapStyle = newStrokeCapStyle
    console.log(`New cell wall width percent is ${mazeOptions.cellWallStrokeCapStyle}`)
  }

  useEffect(() => {
    // Update the document title using the browser API
    var sketch = (p: p5) => {
      // cellSizeSlider = p.createSlider(6, 255, 100)
      // cellSizeSlider.position(width / 2, height + controlsTopPadding)
      // let mazeOptions.cellSize = cellSizeSlider.value()
      // if (typeof mazeOptions.cellSize === "string") {
      //   mazeOptions.cellSize = parseInt(mazeOptions.cellSize, 10)
      // }
      new MazeGenerator(
        p,
        width,
        height,
        mazeOptions.cellSize,
        mazeOptions.cellColor,
        mazeOptions.cellWallSize,
        mazeOptions.cellWallColor,
        mazeOptions.backgroundColor)
    }
    new p5(sketch);
  });
  //handle cell size change
  const handleCellWidthChangeInApp = (event: ChangeEvent<HTMLSelectElement>) => {
    mazeOptionsSetter.handleCellWidthChange(event)
    rerunMaze()
  }
  const handleCellWallWidthPercentChangeInApp = (event: ChangeEvent<HTMLSelectElement>) => {
    mazeOptionsSetter.handleCellWallWidthPercentChange(event)
  }

  //PUT into UI controls generator class

  let interval = 5
  let numberOfOptions = Math.floor((maxCellWidth - minCellWidth) / interval)
  let optionsValue = minCellWidth
  let dropDownForCellWidth = <select onChange={handleCellWidthChangeInApp}>
    {
      new Array(numberOfOptions).fill(1).map(item => {
        let valueToUse = optionsValue
        optionsValue += interval
        return <option
          key={valueToUse}
          value={valueToUse}
          selected={valueToUse === mazeOptions.cellSize}
        >{valueToUse

          }</option>
      })
    }
  </select>

  let minStokeWidth = 1
  let maxStrokeWidth = mazeOptions.cellSize / 2
  let wallStrokeWidthInterval = 1
  let numberOfOptionsForStrokeWidth = Math.floor(maxStrokeWidth - minStokeWidth)
  let optionsValueForStrokeWidth = minStokeWidth
  let dropDownForCellWidthForStrokeWidth = <select onChange={handleCellWallWidthPercentChangeInApp}>
    {
      new Array(numberOfOptionsForStrokeWidth).fill(1).map(item => {
        let valueToUse = optionsValueForStrokeWidth
        optionsValueForStrokeWidth += wallStrokeWidthInterval
        return <option
          key={valueToUse}
          value={valueToUse}
          selected={valueToUse === mazeOptions.cellWallSize}>{valueToUse}</option>
      })
    }
  </select>
  // let dropDownForCellWidthForStrokeCap = <select onChange={handleCellWallStrokeCap}>
  //   {
  //     new Array(numberOfOptionsForStrokeWidth).fill(1).map(item => {
  //       let valueToUse = optionsValueForStrokeWidth
  //       optionsValueForStrokeWidth += wallStrokeWidthInterval
  //       return <option
  //         key={valueToUse}
  //         value={valueToUse}
  //         selected={valueToUse === mazeOptions.cellWallStrokeCapStyle}>
  //         {valueToUse}
  //         </option>
  //     })
  //   }
  // </select>


  return (
    <div className="App">
      <div className="grid-controls">
        <div>Cell Width</div>
        <div>
          {dropDownForCellWidth}
        </div>
        <div>Cell Wall Percent</div>
        <div>
          {dropDownForCellWidthForStrokeWidth}
        </div>
        {/* <div>Cell Wall Cap Style</div>
        <div>
          {dropDownForCellWidthForStrokeCap}
        </div> */}
      </div>
      <div className="color-picker-cell-rect">
        <div>Cell Color</div>
        <SketchPicker
          color={mazeDefaultOptions.defaultCellColor}
          onChange={mazeOptionsSetter.handleCellColorChange}
        // onChangeComplete={handleColorChangeComplete}
        />
      </div>
      <div className="color-picker-cell-wall">
        <div>Cell Wall Color</div>
        <SketchPicker
          color={mazeDefaultOptions.defaultCellWallColor}
          onChange={mazeOptionsSetter.handleCellWallColorChange}
        // onChangeComplete={handleColorChangeComplete}
        />
      </div>
      <div className="color-picker-background">
        <div>Background Color</div>
        <SketchPicker
          color={mazeDefaultOptions.defaultBackgroundColor}
          onChange={mazeOptionsSetter.handleBackgroundColorChange}
        // onChangeComplete={handleColorChangeComplete}
        />
      </div>
    </div>
  );
}

export default App;
