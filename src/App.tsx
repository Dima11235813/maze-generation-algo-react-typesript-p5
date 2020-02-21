import React, { useEffect, ChangeEvent, useContext } from "react";
import { SketchPicker } from "react-color";
import { MazeGenerator } from "./mazeGenComp/MazeGenerator";
import p5 from "p5";
import { MazeOptions } from "./mazeGenComp/mazeUtils/mazeOptions";
import { MazeOptionsSetter } from "./mazeGenComp/mazeUtils/mazeOptionsSetter";
import { logger, loggerObj } from "./utils/loggingUtils";
import CellSizeSlider from "./uiComponents/CellSizeSlider";
import { storageUtils } from "./utils/storageUtils";
import Header from "./views/Header";
import CellWallSizeSlider from "./uiComponents/CellWallSizeSlider";
import { P5_MazeContext, p5_MazeContext } from "./AppContext";
import Footer from "./views/Footer";

const App: React.FC = () => {
  // const mazeContext = useContext({});
  // let mazeOptions: MazeOptions;
  // let mazeOptionsSetter: MazeOptionsSetter;
  let sketchHandler: Function | any;
  let mazeSketch: p5; // holde reference to the sketch
  //set up window resize event
  //bind window resize event handler
  //SET UP SCENE CLASS _ TODO Move to that - WHERE the maze generator operates
  //get the window dimension
  // let controlsTopPadding = 100
  // const mazeContainerRef = useRef(undefined);

  let mazeContext: P5_MazeContext = useContext(p5_MazeContext);
  const { mazeOptionsSetter, mazeOptions, p5_MazeFuncs } = mazeContext!;

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

  useEffect(() => {
    attachEventHandlers();
    createMazeSketch();
  });
  const createMazeSketch = () => {
    sketchHandler = (p: p5) => new MazeGenerator(p, mazeOptions);
    logger("Maze Options:");
    loggerObj(mazeOptions);
    let mazeContainer = document.getElementById("maze-container");
    if (mazeContainer) {
      mazeSketch = new p5(sketchHandler, mazeContainer);
      p5_MazeFuncs.resetMaze = () => {
        rerunMaze();
      };
    }
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
          {/*  TODO Get maze to be generated within this container */}
          <div id="maze-container"></div>
        </div>
      </div>
      <Footer />
    </React.Fragment>
  );
};

export default App;
