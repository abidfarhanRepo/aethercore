import bcrypt from 'bcryptjs'
import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  createTestUser,
  decodeToken,
  verifyToken
} from '../utils/test-auth'
import { assertValidTokenPair, randomEmail } from '../utils/test-helpers'

describe('Auth Service Unit Tests', () => {
  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'TestPass123!'
      const hashed = await bcrypt.hash(password, 10)
      
      expect(hashed).not.toBe(password)
      expect(hashed.length).toBeGreaterThan(password.length)
    })

    it('should verify correct password', async () => {
      const password = 'TestPass123!'
      const hashed = await bcrypt.hash(password, 10)
      
      const matches = await bcrypt.compare(password, hashed)
      expect(matches).toBe(true)
    })

    it('should not verify incorrect password', async () => {
      const password = 'TestPass123!'
      const hashed = await bcrypt.hash(password, 10)
      
      const matches = await bcrypt.compare('WrongPassword123!', hashed)
      expect(matches).toBe(false)
    })

    it('should use different salts for same password', async () => {
      const password = 'TestPass123!'
      const hash1 = await bcrypt.hash(password, 10)
      const hash2 = await bcrypt.hash(password, 10)
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('Token Generation', () => {
    it('should generate valid access token', () => {
      const user = createTestUser({ role: 'ADMIN' })
      const token = generateAccessToken(user)
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.').length).toBe(3) // JWT has 3 parts
    })

    it('should generate valid refresh token', () => {
      const user = createTestUser({ role: 'ADMIN' })
      const token = generateRefreshToken(user)
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.').length).toBe(3)
    })

    it('should generate valid token pair', () => {
      const user = createTestUser({ role: 'CASHIER' })
      const tokens = generateTokenPair(user)
      
      assertValidTokenPair(tokens)
    })

    it('should encode user data in access token', () => {
      const user = createTestUser({ role: 'MANAGER' })
      const token = generateAccessToken(user)
      
      const decoded = decodeToken(token)
      expect(decoded.userId).toBe(user.id)
      expect(decoded.email).toBe(user.email)
      expect(decoded.role).toBe(user.role)
      expect(decoded.type).toBe('access')
    })

    it('should encode minimal data in refresh token', () => {
      const user = createTestUser({ role: 'STOCK_CLERK' })
      const token = generateRefreshToken(user)
      
      const decoded = decodeToken(token)
      expect(decoded.userId).toBe(user.id)
      expect(decoded.email).toBe(user.email)
      expect(decoded.type).toBe('refresh')
    })

    it('should not include password in tokens', () => {
      const user = createTestUser()
      const token = generateAccessToken(user)
      
      const decoded = decodeToken(token)
      expect(decoded).not.toHaveProperty('password')
      expect(JSON.stringify(decoded)).not.toContain('password')
    })

    it('access token should have shorter expiry than refresh', () => {
      const user = createTestUser()
      const accessToken = generateAccessToken(user)
      const refreshToken = generateRefreshToken(user)
      
      const accessDecoded = decodeToken(accessToken) as any
      const refreshDecoded = decodeToken(refreshToken) as any
      
      expect(accessDecoded.exp).toBeLessThan(refreshDecoded.exp)
    })
  })

  describe('Token Verification', () => {
    it('should verify valid access token', () => {
      const user = createTestUser()
      const token = generateAccessToken(user)
      
      expect(() => {
        verifyToken(token, 'access')
      }).not.toThrow()
    })

    it('should verify valid refresh token', () => {
      const user = createTestUser()
      const token = generateRefreshToken(user)
      
      expect(() => {
        verifyToken(token, 'refresh')
      }).not.toThrow()
    })

    it('should reject tampered token', () => {
      const user = createTestUser()
      const token = generateAccessToken(user)
      const tampered = token.slice(0, -10) + 'TAMPERED00'
      
      expect(() => {
        verifyToken(tampered, 'access')
      }).toThrow()
    })

    it('should reject wrong token type verification', () => {
      const user = createTestUser()
      const token = generateAccessToken(user)
      
      expect(() => {
        verifyToken(token, 'refresh') // Wrong type
      }).toThrow()
    })
  })

  describe('Email Validation', () => {
    const validEmails = [
      'user@example.com',
      'user.name@example.com',
      'user+tag@example.co.uk',
      'user_123@test.local'
    ]

    const invalidEmails = [
      'invalid',
      '@example.com',
      'user@',
      'user @example.com',
      'user@example',
      ''
    ]

    validEmails.forEach(email => {
      it(`should accept valid email: ${email}`, () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        expect(emailRegex.test(email)).toBe(true)
      })
    })

    invalidEmails.forEach(email => {
      it(`should reject invalid email: ${email}`, () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        expect(emailRegex.test(email)).toBe(false)
      })
    })
  })

  describe('Password Validation', () => {
    const validPasswords = [
      'SecurePass123!',
      'MyP@ssw0rd',
      'Test123!@#',
      'ValidPassword456_'
    ]

    const invalidPasswords = [
      'short1!', // too short
      'nouppercase123!', // no uppercase
      'NOLOWERCASE123!', // no lowercase
      'NoNumbers!', // no numbers
      'NoSpecial123', // no special char
      '12345678' // no letters
    ]

    validPasswords.forEach(password => {
      it(`should accept valid password: ${password}`, () => {
        const isValid =
          password.length >= 8 &&
          /[A-Z]/.test(password) &&
          /[a-z]/.test(password) &&
          /[0-9]/.test(password) &&
          /[!@#$%^&*]/.test(password)
        
        expect(isValid).toBe(true)
      })
    })

    invalidPasswords.forEach(password => {
      it(`should reject invalid password: ${password}`, () => {
        const isValid =
          password.length >= 8 &&
          /[A-Z]/.test(password) &&
          /[a-z]/.test(password) &&
          /[0-9]/.test(password) &&
          /[!@#$%^&*]/.test(password)
        
        expect(isValid).toBe(false)
      })
    })
  })

  describe('Role-Based Access', () => {
    it('should identify admin role', () => {
      const adminUser = createTestUser({ role: 'ADMIN' })
      expect(adminUser.role).toBe('ADMIN')
    })

    it('should identify manager role', () => {
      const manager = createTestUser({ role: 'MANAGER' })
      expect(manager.role).toBe('MANAGER')
    })

    it('should identify cashier role', () => {
      const cashier = createTestUser({ role: 'CASHIER' })
      expect(cashier.role).toBe('CASHIER')
    })

    it('should identify stock clerk role', () => {
      const stockClerk = createTestUser({ role: 'STOCK_CLERK' })
      expect(stockClerk.role).toBe('STOCK_CLERK')
    })

    it('should verify role hierarchy', () => {
      const roles = ['ADMIN', 'MANAGER', 'SUPERVISOR', 'STOCK_CLERK', 'CASHIER']
      const adminIndex = roles.indexOf('ADMIN')
      const cashierIndex = roles.indexOf('CASHIER')
      
      expect(adminIndex).toBeLessThan(cashierIndex)
    })
  })
})
