import { combineReducers } from 'redux';
import { reducer as formReducer } from 'redux-form'
import { communitiesReducer, communityReducer, accountsReducer, accountReducer, editingReducer, userReducer } from './data/reducer';

export const rootReducer = combineReducers({
  communities: communitiesReducer,
  community: communityReducer,
  accounts: accountsReducer,
  account: accountReducer,
  editing: editingReducer,
  user: userReducer,
});