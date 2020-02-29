import React, { FunctionComponent } from "react";
import { observer, inject } from "mobx-react";

import FormGroup from "@material-ui/core/FormGroup/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";

//https://material-ui.com/components/switches/
import { Switch } from "@material-ui/core";

import { RouterStore } from "mobx-react-router";
import { UiPreferencesStore } from "../../stores/UiPreferencesStore";

interface AnimateMirrorToggleProps {
  routerStore?: RouterStore;
  uiPreferencesStore?: UiPreferencesStore;
}

const AnimateMirrorToggle: FunctionComponent<AnimateMirrorToggleProps> = (
  props: AnimateMirrorToggleProps
) => {
  const { toggleAnimateMirror, animateMirror } = props.uiPreferencesStore!;

  const handleChange = (name: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    let status = event.target.checked;
    console.log("changing inverse color mode to");
    console.log(status);
    toggleAnimateMirror();
  };

  return (
    <FormGroup row>
      <FormControlLabel
        control={
          <Switch
            checked={animateMirror}
            onChange={handleChange("checkedB")}
            value="checkedB"
            color="primary"
          />
        }
        label="Show 3D Mirror"
      />
    </FormGroup>
  );
};

export default inject(
  "uiPreferencesStore",
  "routerStore"
)(observer(AnimateMirrorToggle));
