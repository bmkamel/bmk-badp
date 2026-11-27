const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const str={type:'string'};
const step=obj({id:str,kind:{type:'string',enum:['inspect','design','patch','test','preview']},description:str,dependsOn:{type:'array',items:str}});
export const developmentSchemas={
 plan:obj({plan:obj({goal:str,steps:{type:'array',items:step}})}),
 patch:obj({patches:{type:'array',items:obj({path:str,content:str})}})
};
developmentSchemas.repair=developmentSchemas.patch;
