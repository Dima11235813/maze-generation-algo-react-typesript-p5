import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Slider from "@material-ui/core/Slider";
import Input from "@material-ui/core/Input";
import FormatSize from "@material-ui/icons/FormatSize";

//Maze Config
import { MazeOptionsSetter } from "../mazeGenComp/mazeUtils/mazeOptionsSetter";
import { Labels } from "../shared/labels";
import { logToConsole } from "../shared/logger";

interface CellWallSizeSlider {
  mazeOptionsSetter: MazeOptionsSetter;
  cellWallSize: number;
  maxStrokeWidth: number;
}

const CellWallSizeSlider = (props: CellWallSizeSlider) => {
  const { mazeOptionsSetter, cellWallSize, maxStrokeWidth } = props;
  let minStrokeWidth = 1;
  const useStyles = makeStyles({
    root: {
      width: 200
    },
    input: {
      width: 42
    }
  });
  const classes = useStyles();
  const [value, setValue] = useState(cellWallSize);

  const handleSliderChange = (event: any, newValue: any) => {
    setStateAndPersistSelection(newValue);
  };

  const handleInputChange = (event: any) => {
    let newValue =
      event.target.value === "" ? minStrokeWidth : Number(event.target.value);
    setStateAndPersistSelection(newValue);
  };

  const handleBlur = () => {
    setStateAndPersistSelection(value);
  };

  const setStateAndPersistSelection = (newValue: number) => {
    let valueForStorage = setStateConditionally(newValue);
    mazeOptionsSetter.handleCellWallWidthPercentChange(valueForStorage);
  };
  const setStateConditionally = (newValue: number) => {
    if (newValue < minStrokeWidth) {
      setValue(minStrokeWidth);
      return minStrokeWidth;
    } else if (newValue > maxStrokeWidth) {
      setValue(maxStrokeWidth);
      return maxStrokeWidth;
    } else {
      setValue(newValue);
      return newValue;
    }
  };

  logToConsole(`
    Cell Wall Size Slider render with props:
    minStrokeWidth ${minStrokeWidth}
    maxStrokeWidth ${maxStrokeWidth}
    cellWallSize ${value}
  `);
  return (
    <div className={classes.root}>
      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <FormatSize />
        </Grid>
        <Grid item xs>
          <Slider
            value={typeof value === "number" ? value : minStrokeWidth}
            onChange={handleSliderChange}
            aria-labelledby="input-slider"
          />
        </Grid>
        <Grid item>
          <Input
            className={classes.input}
            value={value}
            margin="dense"
            onChange={handleInputChange}
            onBlur={handleBlur}
            inputProps={{
              step: 1,
              min: minStrokeWidth,
              max: maxStrokeWidth,
              type: "number",
              "aria-labelledby": "input-slider"
            }}
          />
        </Grid>
      </Grid>
    </div>
  );
};
export default CellWallSizeSlider;
