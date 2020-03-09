import React, { useEffect, ChangeEvent, useContext } from "react";
import { MazeGenerator } from "../mazeGenComp/MazeGenerator";
import p5 from "p5";
import { logger, loggerObj } from "../utils/loggingUtils";
import { storageUtils } from "../utils/storageUtils";
import { P5_MazeContext, p5_MazeContext } from "../AppContext";
import { inject, observer } from "mobx-react";
import { RouterStore } from "mobx-react-router";
import { UiPreferencesStore } from "../stores/UiPreferencesStore";
import { logToConsole } from "../shared/logger";
import { MazeViewStore } from "../stores/MazeViewStore";

interface MazeContainerProps {
  routerStore?: RouterStore;
  uiPreferencesStore?: UiPreferencesStore;
  mazeViewStore?: MazeViewStore;
}

const MazeContainer: React.FC<MazeContainerProps> = (
  props: MazeContainerProps
) => {
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
  let mazeContainer: HTMLElement | null;

  const {use3dMode} = props.uiPreferencesStore!;

  const clearMaze = () => {
    logToConsole("Clearing Maze");
    mazeSketch.remove();
  };
  //TODO Extract functions into context
  const rerunMaze = () => {
    logger(`Removing sketch.`);
    clearMaze();
    //destroy current sketch
    logToConsole("Creating new sketch");
    createMazeSketch();
  };

  useEffect(() => {
    mazeContainer = document.getElementById("maze-container");

    // //attch maze click
    // mazeContainer!.addEventListener("click", (event) =>  {
    //   handleMazeContainerClick(event)
    // });
    attachEventHandlers();
    createMazeSketch();
    //TODO Only make this happen when you leave the route
    return () => {
      clearMaze();
    };
  });
  let mazeIsActive = true;
  const createMazeSketch = () => {
    const { frameRate } = mazeOptions;
    sketchHandler = (p: p5) =>
      new MazeGenerator(
        use3dMode,
        mazeIsActive,
        frameRate,
        p,
        mazeOptions
      );
    logger("Maze Options:");
    loggerObj(mazeOptions);
    if (mazeContainer) {
      mazeSketch = new p5(sketchHandler, mazeContainer);
      p5_MazeFuncs.resetMaze = () => {
        rerunMaze();
      };
    }
  };
  // const clickHandler = () => (mazeIsActive = !mazeIsActive);
  const attachEventHandlers = () => {
    window.onresize = function(event: Event) {
      logger(`
        New Widow Width ${window.innerWidth}
        New Window Height ${window.innerHeight}
        `);
      mazeOptions.windowWidth = window.innerWidth;
      mazeOptions.windowHeight = window.innerHeight;
      storageUtils.setMazeoptionsInStorage(mazeOptions);
      rerunMaze();
    };
  };
  return (
    <div>
      <div id="maze-container"></div>
    </div>
  );
};

export default inject(
  "uiPreferencesStore",
  "routerStore",
  "mazeViewStore"
)(observer(MazeContainer));
