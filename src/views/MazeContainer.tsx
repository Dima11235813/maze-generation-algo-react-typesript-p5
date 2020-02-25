import React, { useEffect, ChangeEvent, useContext } from "react";
import { MazeGenerator } from "../mazeGenComp/MazeGenerator";
import p5 from "p5";
import { logger, loggerObj } from "../utils/loggingUtils";
import { storageUtils } from "../utils/storageUtils";
import { P5_MazeContext, p5_MazeContext } from "../AppContext";

const MazeContainer: React.FC = () => {
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
  const { mazeOptions, p5_MazeFuncs } = mazeContext!;

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
      logger(`
        New Widow Width ${window.innerWidth}
        New Window Height ${window.innerHeight}
        `);
      mazeOptions.windowWidth = window.innerWidth;
      mazeOptions.windowHeight = window.innerHeight - 65;
      storageUtils.setMazeoptionsInStorage(mazeOptions);
      rerunMaze();
    };
  };
  return <div id="maze-container"></div>;
};

export default MazeContainer;
