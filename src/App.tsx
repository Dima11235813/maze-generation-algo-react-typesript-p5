import React, { ChangeEvent, useEffect } from "react";
import { SketchPicker } from "react-color";
import "./App.css";
import { MazeGenerator } from "./mazeGenComp/MazeGenerator";
import p5 from "p5";
import { MazeOptions } from "./mazeGenComp/mazeUtils/mazeOptions";
import { MazeOptionsSetter } from "./mazeGenComp/mazeUtils/mazeOptionsSetter";
import { logger, loggerObj } from "./utils/loggingUtils";
import CellSizeSlider from "./uiComponents/CellSizeSlider";
import { storageUtils } from "./utils/storageUtils";
import Header from "./views/Header";
import CellWallSizeSlider from "./uiComponents/CellWallSizeSlider";

const App: React.FC = () => {
  let mazeOptions: MazeOptions;
  let mazeOptionsSetter: MazeOptionsSetter;
  let sketchHandler: Function | any;
  let mazeSketch: p5; // holde reference to the sketch
  //set up window resize event
  //bind window resize event handler
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

  mazeOptions = new MazeOptions();
  mazeOptionsSetter = new MazeOptionsSetter(mazeOptions);
  useEffect(() => {
    attachEventHandlers();
    createMazeSketch();
  });
  const createMazeSketch = () => {
    sketchHandler = (p: p5) => new MazeGenerator(p, mazeOptions);
    logger("Maze Options:");
    loggerObj(mazeOptions);
    mazeSketch = new p5(sketchHandler);
  };
  const attachEventHandlers = () => {
    window.onresize = function(event: Event) {
      console.log(`
        New Widow Width ${window.innerWidth}
        New Window Height ${window.innerHeight}
        `);
      mazeOptions.windowWidth = window.innerWidth;
      mazeOptions.windowHeight = window.innerHeight;
      storageUtils.setMazeoptionsInStorage(mazeOptions);
      rerunMaze();
    };
  };

  const handleCellWallWidthPercentChangeInApp = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {};
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
    <React.Fragment>
      <Header />
      <div className="App">
        <div className="grid-controls">
          <div>
            <CellSizeSlider
              mazeOptionsSetter={mazeOptionsSetter}
              onSizeChange={rerunMaze}
              windowWidth={mazeOptions.windowWidth}
              cellSize={mazeOptions.cellSize}
            />
          </div>
          <div>
            <CellWallSizeSlider
              mazeOptionsSetter={mazeOptionsSetter}
              cellWallSize={mazeOptions.cellWallSize}
              maxStrokeWidth={mazeOptions.maxStrokeWidth}
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
    </React.Fragment>
  );
};

export default App;
