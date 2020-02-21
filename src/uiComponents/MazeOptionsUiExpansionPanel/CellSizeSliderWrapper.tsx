import React, { useContext } from "react";
import { p5_MazeContext, P5_MazeContext } from "../../AppContext";
import { ExpansionPanelWrapper } from "./ExpansionPanel";
import CellSizeSlider from "../CellSizeSlider";
import { Labels } from "../../shared/labels";

export const CellSizeSliderWrapper = () => {
    let mazeContext: P5_MazeContext = useContext(p5_MazeContext);
    const { mazeOptionsSetter, mazeOptions, p5_MazeFuncs } = mazeContext;
    const { resetMaze } = p5_MazeFuncs;
  return (
    <ExpansionPanelWrapper
      name={Labels.CELL_SIZE}
      render={() => (
        <CellSizeSlider
          mazeOptionsSetter={mazeOptionsSetter}
          onSizeChange={resetMaze}
          windowWidth={mazeOptions.windowWidth}
          cellSize={mazeOptions.cellSize}
        />
      )}
    />
  );
};
