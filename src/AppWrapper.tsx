import React from "react";
import { stores } from "./stores";
import { Provider } from "mobx-react";

import ApolloClient from 'apollo-boost'
import { ApolloProvider } from "react-apollo";

//Contexts
import {
  P5_MazeContextInitialValue,
  p5_MazeContext,
  MazeOptionsUiContextInitialValue,
  mazeOptionsUiContext
} from "./AppContext";
import App from "./App";

const client = new ApolloClient({
  uri: "http://localhost:4000/graphql",
  credentials: "include"
});

const AppWrapper = () => {
  return (
    <ApolloProvider client={client}>
      <p5_MazeContext.Provider value={P5_MazeContextInitialValue}>
        <mazeOptionsUiContext.Provider value={MazeOptionsUiContextInitialValue}>
          <Provider {...stores}>
            <App />
          </Provider>
        </mazeOptionsUiContext.Provider>
      </p5_MazeContext.Provider>
    </ApolloProvider>
  );
};
export default AppWrapper;
