const transitions={queued:['running','blocked'],running:['succeeded','failed','blocked'],blocked:['queued'],failed:[],succeeded:[]};
export function transition(job,next,projectId) {
  if (!job || !projectId || job.projectId!==projectId || !Object.hasOwn(transitions,job.status) || !transitions[job.status].includes(next)) throw new Error('invalid transition');
  return {...job,status:next};
}
