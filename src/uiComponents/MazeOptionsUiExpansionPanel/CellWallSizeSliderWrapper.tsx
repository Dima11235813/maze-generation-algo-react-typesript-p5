import React, { useContext } from "react";
import { p5_MazeContext, P5_MazeContext } from "../../AppContext";
import { ExpansionPanelWrapper } from "./ExpansionPanel";
import { Labels } from "../../shared/labels";
import CellWallSizeSlider from "../CellWallSizeSlider";

export const CellWallSizeSliderWrapper = () => {
  let mazeContext: P5_MazeContext = useContext(p5_MazeContext);
  const { mazeOptionsSetter, mazeOptions } = mazeContext;
  return (
    <ExpansionPanelWrapper
      name={Labels.CELL_WALL_SIZE}
      render={() => (
        <CellWallSizeSlider
          mazeOptionsSetter={mazeOptionsSetter}
          cellWallSize={mazeOptions.cellWallSize}
          maxStrokeWidth={mazeOptions.maxStrokeWidth}
        />
      )}
    />
  );
};
