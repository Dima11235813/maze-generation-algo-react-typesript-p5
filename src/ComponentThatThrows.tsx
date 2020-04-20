import React from "react";

class ComponentThatThrows extends React.Component {
  componentDidMount(): void {
    throw new Error("Test throw in component did mount");
  }
  render() {
    return <div>You shouldn't see this component, it's an error component</div>;
  }
}

export default ComponentThatThrows;
