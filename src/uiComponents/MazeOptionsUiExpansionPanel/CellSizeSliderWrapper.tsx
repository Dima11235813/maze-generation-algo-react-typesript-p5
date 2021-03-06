import React, { useContext } from "react";
import {
  p5_MazeContext,
  P5_MazeContext,
  mazeOptionsUiContext,
  MazeOptionsUiContext
} from "../../AppContext";
import { ExpansionPanelWrapper } from "./ExpansionPanel";
import CellSizeSlider from "../CellSizeSlider";
import { Labels } from "../../shared/labels";
import { stores } from "../../stores";

export const CellSizeSliderWrapper = () => {
  let mazeContextInstance: P5_MazeContext = useContext(p5_MazeContext);
  let mazeOptionsUiContextInstance: MazeOptionsUiContext = useContext(
    mazeOptionsUiContext
  );
  const { mazeOptionsSetter, mazeOptions, p5_MazeFuncs } = mazeContextInstance;
  const { panelIsExpandedState } = mazeOptionsUiContextInstance;
  const { resetMaze } = p5_MazeFuncs;
  const { windowWidth } = stores.browserInfoStore;
  return (
    <ExpansionPanelWrapper
      name={Labels.CELL_SIZE}
      panelIsExpanded={panelIsExpandedState.cellSize}
      render={() => (
        <CellSizeSlider
          mazeOptionsSetter={mazeOptionsSetter}
          onSizeChange={resetMaze}
          windowWidth={windowWidth}
          cellSize={mazeOptions.cellSize}
        />
      )}
    />
  );
};
