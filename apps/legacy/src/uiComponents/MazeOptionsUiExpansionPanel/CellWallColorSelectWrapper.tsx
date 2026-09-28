import React, { useContext } from "react";
import { p5_MazeContext, P5_MazeContext, MazeOptionsUiContext, mazeOptionsUiContext } from "../../AppContext";
import { ExpansionPanelWrapper } from "./ExpansionPanel";
import { Labels } from "../../shared/labels";
import { SketchPicker } from "react-color";

export const CellWallColorSelectWrapper = () => {
  let mazeContext: P5_MazeContext = useContext(p5_MazeContext);
  let mazeOptionsUiContextInstance: MazeOptionsUiContext = useContext(
    mazeOptionsUiContext
  );
  const { mazeOptionsSetter, mazeOptions } = mazeContext;
  const { panelIsExpandedState } = mazeOptionsUiContextInstance;
  const { cellWallColor } = mazeOptions;
  const { handleCellWallColorChange } = mazeOptionsSetter;
  return (
    <ExpansionPanelWrapper
      name={Labels.CELL_WALL_COLOR}
      panelIsExpanded={panelIsExpandedState.cellWallColor}
      render={() => (
        <SketchPicker
          color={cellWallColor}
          onChange={handleCellWallColorChange}
          // onChangeComplete={handleColorChangeComplete}
        />
      )}
    />
  );
};
