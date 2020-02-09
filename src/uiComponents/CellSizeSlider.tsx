import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Slider from "@material-ui/core/Slider";
import Input from "@material-ui/core/Input";
import FormatSize from "@material-ui/icons/FormatSize";

//Maze Config
import { MazeOptions } from "../mazeGenComp/mazeUtils/mazeOptions";
import { MazeOptionsSetter } from "../mazeGenComp/mazeUtils/mazeOptionsSetter";
import { Labels } from "../shared/labels";

interface CellSizeSlider {
  mazeOptions: MazeOptions;
  mazeOptionsSetter: MazeOptionsSetter;
  onSizeChange: Function;
}

const CellSizeSlider = (props: CellSizeSlider) => {
  const { mazeOptionsSetter, mazeOptions, onSizeChange } = props;
  //cell width rules
  let minCellWidth = 6;
  let maxCellWidth = mazeOptions.width / 20;
  let cellSizeIncrementor = 2;

  //create ui component
  const useStyles = makeStyles({
    root: {
      width: 200
    },
    input: {
      width: 42
    }
  });
  const classes = useStyles();

  //Set up state for slider
  const [value, setValue] = React.useState(mazeOptions.cellSize);

  //Event for slider
  const handleSliderChange = (event: any, newValue: any) => {
    setStateAndPersistSelection(newValue);
  };
  //Even for input
  const handleInputChange = (event: any) => {
    let newValue =
      event.target.value === "" ? minCellWidth : Number(event.target.value);
    setStateAndPersistSelection(newValue);
  };
  const setStateAndPersistSelection = (newValue: number) => {
    let valueForStorage = setStateConditionally(newValue);
    updateCellSizeForMaze(valueForStorage);
  };
  const updateCellSizeForMaze = (newValue: number) => {
    mazeOptionsSetter.handleCellWidthChange(newValue);
    onSizeChange();
  };

  //state change

  const handleBlur = () => {
    setStateConditionally(value);
  };
  const setStateConditionally = (value: number): number => {
    if (value < minCellWidth) {
      setValue(minCellWidth);
      return minCellWidth;
    } else if (value > maxCellWidth) {
      setValue(maxCellWidth);
      return maxCellWidth;
    } else {
      setValue(value);
      return value;
    }
  };

  return (
    <div className={classes.root}>
      <Typography id="input-slider" gutterBottom>
        {Labels.CELL_WIDTH_LABEL}
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <FormatSize />
        </Grid>
        <Grid item xs>
          <Slider
            value={typeof value === "number" ? value : minCellWidth}
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
              step: cellSizeIncrementor,
              min: minCellWidth,
              max: maxCellWidth,
              type: "number",
              "aria-labelledby": "input-slider"
            }}
          />
        </Grid>
      </Grid>
    </div>
  );
};
export default CellSizeSlider;
