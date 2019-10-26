const { start, dispatch, stop, spawnStateless, spawn } = require('nact');
const system = start();

const greeter = spawnStateless(
  system, // parent
  (msg, ctx) => console.log(`Hello ${msg.name}`), // function
  'greeter' // name
);

const statefulGreeter = spawn(
  system, 
  (state = {}, msg, ctx) => {
    const hasPreviouslyGreetedMe = state[msg.name] !== undefined;
    if(hasPreviouslyGreetedMe) {
      console.log(`Hello again ${msg.name}.`);  
      return state;
    } else {
      console.log(
        `Good to meet you, ${msg.name}.\nI am the ${ctx.name} service!`
      );
      return { ...state, [msg.name]: true };
    }
  },
  'stateful-greeter'
);

const delay = (time) => new Promise((res) => setTimeout(res, time));

const ping = spawnStateless(system, async (msg, ctx) =>  {
  console.log(msg);
  // ping: Pong is a little slow. So I'm giving myself a little handicap :P
  await delay(500);
  dispatch(ctx.sender, ctx.name, ctx.self);
}, 'ping');

const pong = spawnStateless(system, (msg, ctx) =>  {
  console.log(msg);
  dispatch(ctx.sender, ctx.name, ctx.self);  
}, 'pong');

dispatch(ping, 'begin', pong);
dispatch(greeter, { name: 'Erlich Bachman' });
dispatch(statefulGreeter, { name: 'Omar Little' });
dispatch(statefulGreeter, { name: 'Omar Little' });
