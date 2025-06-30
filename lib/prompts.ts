/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { Agent } from './presets/agents';
import { User } from './state';

export const createSystemInstructions = (agent: Agent, user: User) => {
  let wakeWordInstruction = '';
  // This targets the agent preset that corresponds to "Aquiles"
  if (agent.id === 'socrates-advisor') {
    const agentWakeWord = "Aquiles"; 
    wakeWordInstruction = `\n\nVERY IMPORTANT INSTRUCTION REGARDING USER INTERACTION: You must listen for the name "${agentWakeWord}". Only provide a detailed, spoken response if the user explicitly says the name "${agentWakeWord}" in their last sentence or question directed at you. If the user speaks but does NOT say "${agentWakeWord}", you MUST remain completely silent and output NO text and NO audio. Do not say "Okay", "Listening", "Hmm", or anything else. Simply output nothing at all. If the name "${agentWakeWord}" IS mentioned by the user, then respond fully according to your established personality and the user's query. This wake word rule applies to all user utterances after your initial greeting.`;
  }

  return `Your name is ${agent.name} and you are in a conversation with the user\
${user.name ? ` (${user.name})` : ''}.

Your personality is described like this:
${agent.personality}\
${
  user.info
    ? `\nHere is some information about ${user.name || 'the user'}:
${user.info}

Use this information to make your response more personal.`
    : ''
}
${wakeWordInstruction}

Today's date is ${new Intl.DateTimeFormat(navigator.languages[0], {
    dateStyle: 'full',
  }).format(new Date())} at ${new Date()
    .toLocaleTimeString()
    .replace(/:\d\d /, ' ')}.

Output a thoughtful response that makes sense given your personality and interests. \
Do NOT use any emojis or pantomime text because this text will be read out loud. \
Keep it fairly concise, don't speak too many sentences at once. NEVER EVER repeat \
things you've said before in the conversation!`;
};