/// <reference types="Cypress" />

context('Manage emails', () => {
  beforeEach(() => cy.serverCommand('clearTestUsers'))

  it('can navigate to settings page', () => {
    // Setup
    cy.login({ redirectTo: '/', password: null, verified: true })

    // Action
    cy.getCy('nav-settings').click()
    cy.url().should('equal', Cypress.env('VITE_ROOT_URL') + '/settings')
  })

  it('can add an email, verify it, make it primary, and delete original email', () => {
    const email = 'newemail@example.com'
    // Setup
    cy.login({ redirectTo: '/settings', verified: true })
    cy.contains('testuser@example.com').should('exist')
    cy.getCy('email-settings-indicator-unverified').should('not.exist')

    // Action: add existing email
    cy.getCy('settings-show-add-email-button').click()
    cy.getCy('settings-new-email-input').type('testuser@example.com')
    cy.getCy('settings-new-email-submit').click()

    // Assertion
    cy.getCy('settings-new-email-form').within(() => {
      cy.contains('already been created').should('exist')
    })

    // Action: add email
    cy.getCy('settings-new-email-input').clear()
    cy.getCy('settings-new-email-input').type(email)
    cy.getCy('settings-new-email-submit').click()

    // Assertion
    cy.getCy('email-settings-list').within(() => {
      cy.root().should('exist')
      cy.contains('newemail@example.com').should('exist')
      cy.getCy('email-settings-indicator-unverified').should('exist')
    })

    // Action: verify the email
    cy.serverCommand('getEmailSecrets', { email }).then(secrets => {
      const { user_email_id, verification_token } = secrets
      const url = `${Cypress.env('VITE_ROOT_URL')}/verify?id=${encodeURIComponent(
        user_email_id,
      )}&token=${encodeURIComponent(verification_token!)}`
      cy.visit(url)
      cy.getCy('email-verified').should('exist')
      cy.visit(Cypress.env('VITE_ROOT_URL') + '/settings')
    })

    // Assertion
    cy.getCy('email-settings-item-testuser-example-com').within(() => {
      cy.root().should('exist')
      cy.getCy('email-settings-indicator-primary').should('exist')
      cy.getCy('email-settings-button-makeprimary').should('not.exist')
    })
    cy.getCy('email-settings-item-newemail-example-com').within(() => {
      cy.root().should('exist')
      cy.contains('newemail@example.com').should('exist')
      cy.getCy('email-settings-indicator-unverified').should('not.exist')
      cy.getCy('email-settings-button-makeprimary').should('exist')
    })

    // Action: make new email primary
    cy.getCy('email-settings-button-makeprimary').click()

    // Assertions
    cy.getCy('email-settings-item-testuser-example-com').within(() => {
      cy.root().should('exist')
      cy.getCy('email-settings-indicator-primary').should('not.exist')
      cy.getCy('email-settings-button-makeprimary').should('exist')
    })
    cy.getCy('email-settings-item-newemail-example-com').within(() => {
      cy.root().should('exist')
      cy.getCy('email-settings-indicator-primary').should('exist')
      cy.getCy('email-settings-button-makeprimary').should('not.exist')
    })

    // Action: delete old email
    cy.getCy('email-settings-item-testuser-example-com').within(() => {
      cy.getCy('email-settings-button-delete').click()
    })

    // Assertions
    cy.getCy('email-settings-item-testuser-example-com').should('not.exist')
  })
})
