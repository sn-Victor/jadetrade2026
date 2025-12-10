// AWS Configuration
export const awsConfig = {
  region: 'us-east-2',
  cognito: {
    userPoolId: 'us-east-2_qovyryhwW',
    clientId: '43vb50etsolvu83klfjskgqbs2',
  },
  apiGateway: {
    url: 'https://ng5f96b0lg.execute-api.us-east-2.amazonaws.com/prod',
  },
  stripe: {
    publishableKey: 'pk_test_51SapxWRtkvbRG2krLX1Yka6Anx3oNnylPNFqTsprLTyNT6nTy6l5aaswWKV0En376AbGn9wmUQLlzZDbmtPGdgWZ00sNnmq8P5',
  },
};