import React, { useContext } from "react";
import { p5_MazeContext, P5_MazeContext, MazeOptionsUiContext, mazeOptionsUiContext } from "../../AppContext";
import { ExpansionPanelWrapper } from "./ExpansionPanel";
import { Labels } from "../../shared/labels";
import { SketchPicker } from "react-color";

export const MazeBackgroundColorSelectWrapper = () => {
  let mazeContext: P5_MazeContext = useContext(p5_MazeContext);
  let mazeOptionsUiContextInstance: MazeOptionsUiContext = useContext(
    mazeOptionsUiContext
  );
  const { panelIsExpandedState } = mazeOptionsUiContextInstance;
  const { mazeOptionsSetter, mazeOptions } = mazeContext;
  const { backgroundColor } = mazeOptions;
  const { handleBackgroundColorChange } = mazeOptionsSetter;
  return (
    <ExpansionPanelWrapper
      panelIsExpanded={panelIsExpandedState.mazeBackgroundColor}
      name={Labels.CELL_SIZE}
      render={() => (
        <SketchPicker
          color={backgroundColor}
          onChange={handleBackgroundColorChange}
          // onChangeComplete={handleColorChangeComplete}
        />
      )}
    />
  );
};
