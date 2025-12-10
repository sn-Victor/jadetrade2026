const fs = require('fs');

const stripeContent = `const Stripe = require('stripe');
const { query } = require('../db');
const { getUserFromToken } = require('../auth');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

const PRICE_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID
};

exports.createCheckoutSession = async (event) => {
  try {
    const user = await getUserFromToken(event.headers.Authorization || event.headers.authorization);
    const { tier, successUrl, cancelUrl } = JSON.parse(event.body);
    if (!['pro', 'enterprise'].includes(tier)) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid tier' }) };
    }
    let userResult = await query('SELECT * FROM users WHERE id = $1', [user.id]);
    let stripeCustomerId = userResult.rows[0]?.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
      stripeCustomerId = customer.id;
      await query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [stripeCustomerId, user.id]);
    }
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PRICE_IDS[tier], quantity: 1 }],
      success_url: successUrl || 'http://localhost:8081/dashboard?success=true',
      cancel_url: cancelUrl || 'http://localhost:8081/pricing?canceled=true',
      metadata: { userId: user.id, tier }
    });
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ sessionId: session.id, url: session.url }) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: error.message.includes('token') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

exports.createPortalSession = async (event) => {
  try {
    const user = await getUserFromToken(event.headers.Authorization || event.headers.authorization);
    const userResult = await query('SELECT stripe_customer_id FROM users WHERE id = $1', [user.id]);
    const stripeCustomerId = userResult.rows[0]?.stripe_customer_id;
    if (!stripeCustomerId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'No subscription found' }) };
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: 'http://localhost:8081/dashboard'
    });
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ url: session.url }) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: error.message.includes('token') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

exports.getPaymentHistory = async (event) => {
  try {
    const user = await getUserFromToken(event.headers.Authorization || event.headers.authorization);
    const result = await query('SELECT * FROM payment_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [user.id]);
    return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(result.rows) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: error.message.includes('token') ? 401 : 500, headers: corsHeaders, body: JSON.stringify({ error: error.message }) };
  }
};

exports.handleWebhook = async (event) => {
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook sig failed:', err.message);
    return { statusCode: 400, body: 'Webhook Error: ' + err.message };
  }
  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const userId = session.metadata.userId;
        const tier = session.metadata.tier;
        await query('UPDATE users SET subscription_tier = $1, stripe_subscription_id = $2, updated_at = now() WHERE id = $3', [tier, session.subscription, userId]);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = stripeEvent.data.object;
        const customer = await stripe.customers.retrieve(subscription.customer);
        const userId = customer.metadata.userId;
        await query('UPDATE users SET subscription_tier = $1, stripe_subscription_id = NULL, updated_at = now() WHERE id = $2', ['free', userId]);
        break;
      }
      case 'invoice.paid': {
        const invoice = stripeEvent.data.object;
        const customer = await stripe.customers.retrieve(invoice.customer);
        const userId = customer.metadata.userId;
        if (userId) {
          await query('INSERT INTO payment_history (user_id, stripe_invoice_id, amount, currency, status, description) VALUES ($1, $2, $3, $4, $5, $6)',
            [userId, invoice.id, invoice.amount_paid / 100, invoice.currency, 'paid', invoice.description || 'Subscription payment']);
        }
        break;
      }
    }
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error('Webhook error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};`;

fs.writeFileSync('src/handlers/stripe.js', stripeContent);
console.log('stripe.js written');