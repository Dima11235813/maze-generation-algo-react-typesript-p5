import React from "react";
import styles from "./MazeOptionsUi.module.scss";
import { SketchPicker } from "react-color";

export default function MazeOptionsUi() {
  return (
    <div className={styles.mazeOptionsUi}>
      <div className="color-picker-background">
        <div>Background Color</div>
        sketch piccker
        {/* <SketchPicker
          color={mazeOptions.backgroundColor}
          onChange={mazeOptionsSetter.handleBackgroundColorChange}
          // onChangeComplete={handleColorChangeComplete}
        /> */}
      </div>
    </div>
  );
}
