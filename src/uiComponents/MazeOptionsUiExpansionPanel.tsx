import React, { useContext, useState } from "react";

import { makeStyles, Theme, createStyles } from "@material-ui/core/styles";
import { p5_MazeContext, P5_MazeContext } from "../AppContext";
import CellWallSizeSlider from "./CellWallSizeSlider";
import { SketchPicker } from "react-color";
import { Labels } from "../shared/labels";
import { FormControl, Select, MenuItem } from "@material-ui/core";
import { ExpansionPanelWrapper } from "./MazeOptionsUiExpansionPanel/ExpansionPanel";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: "100%"
    }
  })
);
export enum CellWallOptions {
  ROUND = "ROUND",
  SQUARE = "SQUARE",
  PROJECT = "PROJECT"
}

//TODO Move to maze options ui defaults
export default function MazeOptionsUiExpansionPanel() {
  const CELL_SIZE_PANEL_DEFAULT = true;
  const CELL_COLOR_PANEL_DEFAULT = true;
  let mazeContext: P5_MazeContext = useContext(p5_MazeContext);
  const { mazeOptionsSetter, mazeOptions, p5_MazeFuncs } = mazeContext!;
  const { resetMaze } = p5_MazeFuncs;
  const classes = useStyles();
  //Cell wall style state
  const [cellWallStyle, setCellWallStyle] = useState<string>(
    mazeOptions.cellWallStrokeCapStyle
  );

  const handleCellWallStyleChange = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    let newValue = event.target.value as string;
    mazeOptionsSetter.handleCellWallStyleChange(newValue);
    setCellWallStyle(newValue);
  };
  return (
    <div className={classes.root}>
      <ExpansionPanelWrapper name={Labels.HEADER} />
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
      <ExpansionPanelWrapper
        name={Labels.CELL_COLOR}
        render={() => (
          <SketchPicker
            color={mazeOptions.cellColor}
            onChange={mazeOptionsSetter.handleCellColorChange}
            // onChangeComplete={handleColorChangeComplete}
          />
        )}
      />
      <ExpansionPanelWrapper
        name={Labels.CELL_COLOR}
        render={() => (
          <SketchPicker
            color={mazeOptions.cellWallColor}
            onChange={mazeOptionsSetter.handleCellWallColorChange}
            // onChangeComplete={handleColorChangeComplete}
          />
        )}
      />
      <ExpansionPanelWrapper
        name={Labels.MAZE_BACKGROUND_COLOR}
        render={() => (
          <SketchPicker
            color={mazeOptions.backgroundColor}
            onChange={mazeOptionsSetter.handleBackgroundColorChange}
            // onChangeComplete={handleColorChangeComplete}
          />
        )}
      />
      <ExpansionPanelWrapper
        name={Labels.MAZE_BACKGROUND_COLOR}
        render={() => (
          <Select
            labelId="demo-simple-select-label"
            id="demo-simple-select"
            value={cellWallStyle}
            onChange={handleCellWallStyleChange}
          >
            {Object.values(CellWallOptions).map((cellWallOption: string) => (
              <MenuItem value={cellWallOption}>{cellWallOption}</MenuItem>
            ))}
          </Select>
        )}
      />
    </div>
  );
}
