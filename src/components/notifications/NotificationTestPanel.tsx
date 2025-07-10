'use client'

import { useState } from 'react'
import { 
  EnvelopeIcon, 
  Cog6ToothIcon, 
  ExclamationTriangleIcon, 
  CheckCircleIcon, 
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

interface TestResult {
  success: boolean
  message: string
  type: string
}

export default function NotificationTestPanel() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [testResults, setTestResults] = useState<TestResult[]>([])

  const testTypes = [
    {
      id: 'connection',
      name: 'Connection Test',
      description: 'Test email service connection and send a basic test email',
      icon: EnvelopeIcon,
      color: 'blue'
    },
    {
      id: 'notification',
      name: 'System Notification',
      description: 'Test the notification system with a sample alert',
      icon: Cog6ToothIcon,
      color: 'purple'
    },
    {
      id: 'production',
      name: 'Production Alert',
      description: 'Test production completion notification',
      icon: Cog6ToothIcon,
      color: 'green'
    },
    {
      id: 'order',
      name: 'Order Update',
      description: 'Test order dispatch notification',
      icon: EnvelopeIcon,
      color: 'blue'
    },
    {
      id: 'wastage',
      name: 'Wastage Alert',
      description: 'Test high wastage alert notification',
      icon: ExclamationTriangleIcon,
      color: 'red'
    }
  ]

  const handleTest = async (testType: string) => {
    if (!email) {
      alert('Please enter an email address')
      return
    }

    setIsLoading(true)
    
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          type: testType
        })
      })

      const result = await response.json()
      
      setTestResults(prev => [{
        success: result.success,
        message: result.message || (result.success ? 'Test completed successfully' : 'Test failed'),
        type: testType
      }, ...prev.slice(0, 9)]) // Keep only last 10 results

    } catch (error) {
      console.error('Test failed:', error)
      setTestResults(prev => [{
        success: false,
        message: 'Network error or server unavailable',
        type: testType
      }, ...prev.slice(0, 9)])
    } finally {
      setIsLoading(false)
    }
  }

  const processQueue = async () => {
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/notifications/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ limit: 50 })
      })

      const result = await response.json()
      
      setTestResults(prev => [{
        success: result.success,
        message: result.message || `Processed ${result.processed || 0} notifications`,
        type: 'queue_process'
      }, ...prev.slice(0, 9)])

    } catch (error) {
      console.error('Queue processing failed:', error)
      setTestResults(prev => [{
        success: false,
        message: 'Failed to process notification queue',
        type: 'queue_process'
      }, ...prev.slice(0, 9)])
    } finally {
      setIsLoading(false)
    }
  }

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
      purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
      green: 'bg-green-50 text-green-600 hover:bg-green-100',
      red: 'bg-red-50 text-red-600 hover:bg-red-100'
    }
    return colors[color as keyof typeof colors] || colors.blue
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Notification System Testing</h3>
        <p className="text-sm text-gray-600">
          Test email notifications and monitor the notification queue. Make sure to configure SMTP settings in your environment variables.
        </p>
      </div>

      {/* Email Input */}
      <div className="mb-6">
        <label htmlFor="test-email" className="block text-sm font-medium text-gray-700 mb-2">
          Test Email Address
        </label>
        <input
          type="email"
          id="test-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email address for testing"
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Test Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {testTypes.map((test) => {
          const IconComponent = test.icon
          return (
            <button
              key={test.id}
              onClick={() => handleTest(test.id)}
              disabled={isLoading || !email}
              className={`p-4 rounded-lg border-2 border-transparent transition-all duration-200 ${getColorClasses(test.color)} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-center mb-2">
                <IconComponent className="h-6 w-6" />
              </div>
              <h4 className="font-medium text-sm mb-1">{test.name}</h4>
              <p className="text-xs opacity-80">{test.description}</p>
            </button>
          )
        })}
      </div>

      {/* Queue Processing */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">Process Notification Queue</h4>
            <p className="text-sm text-gray-600">Manually process pending notifications in the queue</p>
          </div>
          <button
            onClick={processQueue}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            <ClockIcon className="h-4 w-4 mr-2" />
            Process Queue
          </button>
        </div>
      </div>

      {/* Test Results */}
      {testResults.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Test Results</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {testResults.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-md border-l-4 ${
                  result.success 
                    ? 'bg-green-50 border-green-400' 
                    : 'bg-red-50 border-red-400'
                }`}
              >
                <div className="flex items-center">
                  {result.success ? (
                    <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {result.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-sm text-gray-600">{result.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Configuration Help */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Email Configuration</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <p>To enable email notifications, configure these environment variables:</p>
          <ul className="list-disc list-inside ml-2 space-y-1">
            <li><code>SMTP_HOST</code> - Your SMTP server (e.g., smtp.gmail.com)</li>
            <li><code>SMTP_PORT</code> - SMTP port (usually 587)</li>
            <li><code>SMTP_USER</code> - Your email address</li>
            <li><code>SMTP_PASS</code> - Your email password or app password</li>
            <li><code>SMTP_FROM</code> - From email address for notifications</li>
          </ul>
          <p className="mt-2 text-xs">
            For Gmail, use an App Password instead of your regular password.
          </p>
        </div>
      </div>
    </div>
  )
} 