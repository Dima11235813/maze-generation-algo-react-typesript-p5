import React, { useEffect, ChangeEvent, useContext } from "react";
import { MazeGenerator } from "../mazeGenComp/MazeGenerator";
import p5 from "p5";
import { logger, loggerObj } from "../utils/loggingUtils";
import { storageUtils } from "../utils/storageUtils";
import { P5_MazeContext, p5_MazeContext } from "../AppContext";
import { inject, observer } from "mobx-react";
import { RouterStore } from "mobx-react-router";
import { UiPreferencesStore } from "../stores/UiPreferencesStore";

interface MazeContainerProps {
  routerStore?: RouterStore;
  uiPreferencesStore?: UiPreferencesStore;
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

  const { use3dMode } = props.uiPreferencesStore!;
  const clear3dMaze = () => {
    if (mazeContainer) {
      mazeContainer.innerHTML = "";
    }
  };
  const rerunMaze = () => {
    logger(`Removing sketch.`);
    //TODO this doesn't work in 3d mode - handle another way
    if (use3dMode) {
      clear3dMaze();
    } else {
      mazeSketch.remove();
    }
    //destroy current sketch
    createMazeSketch();
  };

  useEffect(() => {
    mazeContainer = document.getElementById("maze-container");
    attachEventHandlers();
    createMazeSketch();
    //TODO Only make this happen when you leave the route
    return () => {
      clear3dMaze()
    }
  });
  const createMazeSketch = () => {
    sketchHandler = (p: p5) => new MazeGenerator(use3dMode, p, mazeOptions);
    logger("Maze Options:");
    loggerObj(mazeOptions);
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
      mazeOptions.windowHeight = window.innerHeight;
      storageUtils.setMazeoptionsInStorage(mazeOptions);
      rerunMaze();
    };
  };
  return <div id="maze-container"></div>;
};

export default inject(
  "uiPreferencesStore",
  "routerStore"
)(observer(MazeContainer));
