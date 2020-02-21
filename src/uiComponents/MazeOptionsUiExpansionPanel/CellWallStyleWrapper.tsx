import React, { useContext, useState } from "react";
import { p5_MazeContext, P5_MazeContext } from "../../AppContext";
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
  const { mazeOptionsSetter, mazeOptions } = mazeContext;
  const { cellWallStrokeCapStyle } = mazeOptions;
  const { handleCellWallStyleChange } = mazeOptionsSetter;
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
      name={Labels.CELL_WALL_STYLE}
      render={() => (
        <Select
          labelId="demo-simple-select-label"
          id="demo-simple-select"
          value={cellWallStyle}
          onChange={handleSelectCellWallStyleChange}
        >
          {Object.values(CellWallOptions).map((cellWallOption: string) => (
            <MenuItem value={cellWallOption}>{cellWallOption}</MenuItem>
          ))}
        </Select>
      )}
    />
  );
};
