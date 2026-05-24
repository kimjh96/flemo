import type { ParamsDispatchContextType } from "./ParamsDispatchContext";

function ParamsReducer(state: object, action: ParamsDispatchContextType) {
  switch (action.type) {
    case "SET":
      return action.params;
    default:
      return state;
  }
}

export default ParamsReducer;
