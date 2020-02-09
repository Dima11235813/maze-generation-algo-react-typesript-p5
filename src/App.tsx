import React, { useState, ChangeEvent, useEffect } from "react";
import { SketchPicker, ColorPickerProps, RGBColor } from "react-color";
import "./App.css";
import { MazeGenerator } from "./mazeGenComp/MazeGenerator";
import p5 from "p5";
import { Color } from "./utils/colorUtils";
import { GRID_CELL_WIDTH } from "./constants/gridConstants";
import { mazeDefaultsStorageKeys } from "./utils/storageUtils";
import { mazeDefaultOptions } from "./mazeGenComp/mazeUtils/mazeDefaults";
import { MazeOptions } from "./mazeGenComp/mazeUtils/mazeOptions";
import { MazeOptionsSetter } from "./mazeGenComp/mazeUtils/mazeOptionsSetter";
import { logger, loggerObj } from "./utils/loggingUtils";
import CellSizeSlider from "./uiComponents/CellSizeSlider";

const App: React.FC = () => {
  let mazeSketch: p5; // holde reference to the sketch
  let sketchHandler;
  let mazeOptions = new MazeOptions();
  let mazeOptionsSetter = new MazeOptionsSetter(mazeOptions);

  logger("Maze Options:");
  loggerObj(mazeOptions);
  //SET UP SCENE CLASS _ TODO Move to that - WHERE the maze generator operates
  //get the window dimension
  // let controlsTopPadding = 100

  const rerunMaze = () => {
    logger(`Removing sketch.`);
    mazeSketch.remove();
    //destroy current sketch
    createMazeSketch();
  };

  let handleCellWallStrokeCap = (event: ChangeEvent<HTMLSelectElement>) => {
    let newStrokeCapStyle = event.target.value;
    mazeOptions.cellWallStrokeCapStyle = newStrokeCapStyle;
    logger(
      `New cell wall width percent is ${mazeOptions.cellWallStrokeCapStyle}`
    );
  };

  const createMazeSketch = () => {
    sketchHandler = (p: p5) => new MazeGenerator(p, mazeOptions);
    mazeSketch = new p5(sketchHandler);
  };
  useEffect(() => {
    createMazeSketch();
  });

  const handleCellWallWidthPercentChangeInApp = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    mazeOptionsSetter.handleCellWallWidthPercentChange(event);
  };

  // let minStokeWidth = 1;
  // let maxStrokeWidth = mazeOptions.cellSize / 2;
  // let wallStrokeWidthInterval = 1;
  // let numberOfOptionsForStrokeWidth = Math.floor(
  //   maxStrokeWidth - minStokeWidth
  // );
  // let optionsValueForStrokeWidth = minStokeWidth;
  // let dropDownForCellWidthForStrokeWidth = (
  //   <select onChange={handleCellWallWidthPercentChangeInApp}>
  //     {new Array(numberOfOptionsForStrokeWidth).fill(1).map(item => {
  //       let valueToUse = optionsValueForStrokeWidth;
  //       optionsValueForStrokeWidth += wallStrokeWidthInterval;
  //       return (
  //         <option
  //           key={valueToUse}
  //           value={valueToUse}
  //           selected={valueToUse === mazeOptions.cellWallSize}
  //         >
  //           {valueToUse}
  //         </option>
  //       );
  //     })}
  //   </select>
  // );
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
          <CellSizeSlider
            mazeOptions={mazeOptions}
            mazeOptionsSetter={mazeOptionsSetter}
            onSizeChange={rerunMaze}
          />
        </div>
        {/* <div>Cell Wall Percent</div>
        <div>{dropDownForCellWidthForStrokeWidth}</div> */}
        {/* <div>Cell Wall Cap Style</div>
        <div>
          {dropDownForCellWidthForStrokeCap}
        </div> */}
      </div>
      <div className="color-picker-cell-rect">
        <div>Cell Color</div>
        <SketchPicker
          color={mazeOptions.cellColor}
          onChange={mazeOptionsSetter.handleCellColorChange}
          // onChangeComplete={handleColorChangeComplete}
        />
      </div>
      <div className="color-picker-cell-wall">
        <div>Cell Wall Color</div>
        <SketchPicker
          color={mazeOptions.cellWallColor}
          onChange={mazeOptionsSetter.handleCellWallColorChange}
          // onChangeComplete={handleColorChangeComplete}
        />
      </div>
      <div className="color-picker-background">
        <div>Background Color</div>
        <SketchPicker
          color={mazeOptions.backgroundColor}
          onChange={mazeOptionsSetter.handleBackgroundColorChange}
          // onChangeComplete={handleColorChangeComplete}
        />
      </div>
      <button onClick={rerunMaze}>Create new maze</button>
    </div>
  );
};

export default App;
