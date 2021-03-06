import React, { useContext, useState } from "react";
import {
  p5_MazeContext,
  P5_MazeContext,
  MazeOptionsUiContext,
  mazeOptionsUiContext
} from "../../AppContext";
import { ExpansionPanelWrapper } from "./ExpansionPanel";
import { Labels } from "../../shared/labels";
import { Select, MenuItem } from "@material-ui/core";

export enum CellWallOptions {
  ROUND = "ROUND",
  SQUARE = "SQUARE",
  PROJECT = "PROJECT"
}
export const CellWallStyleWrapper = () => {
  let mazeContext: P5_MazeContext = useContext(p5_MazeContext);
  let mazeOptionsUiContextInstance: MazeOptionsUiContext = useContext(
    mazeOptionsUiContext
  );
  const { mazeOptionsSetter, mazeOptions } = mazeContext;
  const { cellWallStrokeCapStyle } = mazeOptions;
  const { handleCellWallStyleChange } = mazeOptionsSetter;
  const { panelIsExpandedState } = mazeOptionsUiContextInstance;
  //TODO Extract state to styleSelectWrapper
  //Cell wall style state
  const [cellWallStyle, setCellWallStyle] = useState<string>(
    cellWallStrokeCapStyle
  );
  const handleSelectCellWallStyleChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    let newValue = event.target.value as string;
    handleCellWallStyleChange(newValue);
    setCellWallStyle(newValue);
  };
  return (
    <ExpansionPanelWrapper
      panelIsExpanded={panelIsExpandedState.cellWallStyle}
      name={Labels.CELL_WALL_STYLE}
      render={() => (
        <Select
          labelId="demo-simple-select-label"
          id="demo-simple-select"
          value={cellWallStyle}
          onChange={handleSelectCellWallStyleChange}
        >
          {Object.values(CellWallOptions).map((cellWallOption: string) => (
            <MenuItem key={cellWallOption} value={cellWallOption}>{cellWallOption}</MenuItem>
          ))}
        </Select>
      )}
    />
  );
};
