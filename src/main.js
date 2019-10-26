const uuid = require('uuid/v4');
const { start, query, dispatch, stop, spawnStateless, spawn } = require('nact');
const system = start();
const express = require('express');
const app = express();
const bodyParser = require('body-parser');

const ContactProtocolTypes = {
   GET_CONTACTS: 'GET_CONTACTS',
   GET_CONTACT: 'GET_CONTACT',
   UPDATE_CONTACT: 'UPDATE_CONTACT',
   REMOVE_CONTACT: 'REMOVE_CONTACT',
   CREATE_CONTACT: 'CREATE_CONTACT',
   // Operation sucessful
   SUCCESS: 'SUCCESS',
   // And finally if the contact is not found
   NOT_FOUND: 'NOT_FOUND'
};

const contactsService = spawn(
  system,
  (state = { contacts:{} }, msg, ctx) => {    
    if(msg.type === ContactProtocolTypes.GET_CONTACTS) {
        // Return all the contacts as an array
        dispatch(
          ctx.sender, 
          { payload: Object.values(state.contacts), type: ContactProtocolTypes.SUCCESS }, 
          ctx.self
        );
    } else if (msg.type === ContactProtocolTypes.CREATE_CONTACT) {
        const newContact = { id: uuid(), ...msg.payload };
        const nextState = { 
          contacts: { ...state.contacts, [newContact.id]: newContact } 
        };
        dispatch(ctx.sender, { type: ContactProtocolTypes.SUCCESS, payload: newContact });
        return nextState;
    } else {
        // All these message types require an existing contact
        // So check if the contact exists
        const contact = state.contacts[msg.contactId];
        if (contact) {
            switch(msg.type) {
              case ContactProtocolTypes.GET_CONTACT: {
                dispatch(ctx.sender, { payload: contact, type: ContactProtocolTypes.SUCCESS });
                break;
              }
              case ContactProtocolTypes.REMOVE_CONTACT: {
                // Create a new state with the contact value to undefined
                const nextState = { ...state.contacts, [contact.id]: undefined };
                dispatch(ctx.sender, { type: ContactProtocolTypes.SUCCESS, payload: contact });
                return nextState;                 
              }
              case ContactProtocolTypes.UPDATE_CONTACT:  {
                // Create a new state with the previous fields of the contact 
                // merged with the updated ones
                const updatedContact = {...contact, ...msg.payload };
                const nextState = { 
                  ...state.contacts,
                  [contact.id]: updatedContact 
                };
                dispatch(ctx.sender, { type: ContactProtocolTypes.SUCCESS, payload: updatedContact });
                return nextState;                 
              }
            }
        } else {
          // If it does not, dispatch a not found message to the sender          
          dispatch(
            ctx.sender, 
            { type: ContactProtocolTypes.NOT_FOUND, contactId: msg.contactId }, 
            ctx.self
          );
        }
    }      
    // Return the current state if unchanged.
    return state;
  },
  'contacts'
);

const performQuery = async (msg, res) => {
  try {
    const result = await query(contactsService, msg, 500); // Set a 250ms timeout
    switch(result.type) {
      case ContactProtocolTypes.SUCCESS: res.json(result.payload); break;
      case ContactProtocolTypes.NOT_FOUND: res.sendStatus(404); break;
      default:
        // This shouldn't ever happen, but means that something is really wrong in the application
        console.error(JSON.stringify(result));
        res.sendStatus(500);
        break;
    }
  } catch (e) {
    // 504 is the gateway timeout response code. Nact only throws on queries to a valid actor reference if the timeout 
    // expires.
    res.sendStatus(504);
  }
};

app.use(bodyParser.json());

app.get('/api/contacts', (req,res) => performQuery({ type: ContactProtocolTypes.GET_CONTACTS }, res));

app.get('/api/contacts/:contact_id', (req,res) => 
  performQuery({ type: ContactProtocolTypes.GET_CONTACT, contactId: req.params.contact_id }, res)
);

app.post('/api/contacts', (req,res) => performQuery({ type: ContactProtocolTypes.CREATE_CONTACT, payload: req.body }, res));

app.patch('/api/contacts/:contact_id', (req,res) => 
  performQuery({ type: ContactProtocolTypes.UPDATE_CONTACT, contactId: req.params.contact_id, payload: req.body }, res)
);

app.delete('/api/contacts/:contact_id', (req,res) => 
  performQuery({ type: ContactProtocolTypes.REMOVE_CONTACT, contactId: req.params.contact_id }, res)
);

app.listen(process.env.PORT || 3000, function () {
  console.log(`Address book listening on port ${process.env.PORT || 3000}!`);
});

