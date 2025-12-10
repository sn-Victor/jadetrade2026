// AWS Configuration
export const awsConfig = {
  region: 'us-east-1',
  cognito: {
    userPoolId: 'us-east-1_85Oao6j0D',
    clientId: '3qoh99hvo93c1l5m40dmasr53u',
  },
  apiGateway: {
    url: 'https://z031wxxkdg.execute-api.us-east-1.amazonaws.com/prod',
  },
  stripe: {
    publishableKey: 'pk_test_51SapxWRtkvbRG2krLX1Yka6Anx3oNnylPNFqTsprLTyNT6nTy6l5aaswWKV0En376AbGn9wmUQLlzZDbmtPGdgWZ00sNnmq8P5',
  },
};