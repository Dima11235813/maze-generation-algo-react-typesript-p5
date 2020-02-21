import React, { useContext } from "react";
import {
  p5_MazeContext,
  P5_MazeContext,
  MazeOptionsUiContext,
  mazeOptionsUiContext
} from "../../AppContext";
import { ExpansionPanelWrapper } from "./ExpansionPanel";
import { Labels } from "../../shared/labels";
import { SketchPicker } from "react-color";

export const CellColorSelectWrapper = () => {
  let mazeContext: P5_MazeContext = useContext(p5_MazeContext);
  let mazeOptionsUiContextInstance: MazeOptionsUiContext = useContext(
    mazeOptionsUiContext
  );
  const { mazeOptionsSetter, mazeOptions } = mazeContext;
  const { panelIsExpandedState } = mazeOptionsUiContextInstance;
  const { cellColor } = mazeOptions;
  const { handleCellColorChange } = mazeOptionsSetter;
  return (
    <ExpansionPanelWrapper
      panelIsExpanded={panelIsExpandedState.cellSize}
      name={Labels.CELL_COLOR}
      render={() => (
        <SketchPicker
          color={cellColor}
          onChange={handleCellColorChange}
          // onChangeComplete={handleColorChangeComplete}
        />
      )}
    />
  );
};
