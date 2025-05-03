import fs from 'fs'
import path from 'path'
import Handlebars, { TemplateDelegate } from 'handlebars'
import { config } from '../config'
import { logger } from './logger'

/**
 * Template Builder class for rendering email templates and other HTML content
 */
export class TemplateBuilder {
  private static templatesDir: string = path.join(__dirname, '../../templates')
  private static compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map()

  /**
   * Initialize the template builder
   * Loads and compiles all templates in the templates directory
   */
  static initialize(): void {
    try {
      // Ensure templates directory exists
      if (!fs.existsSync(this.templatesDir)) {
        fs.mkdirSync(this.templatesDir, { recursive: true })
        logger.info(`Created templates directory: ${this.templatesDir}`)
      }

      // Register Handlebars helpers
      this.registerHelpers()

      // Preload and compile templates
      this.preloadTemplates()

      logger.info('Template builder initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize template builder:', error)
      throw error
    }
  }

  /**
   * Register custom Handlebars helpers
   */
  private static registerHelpers(): void {
    // Format date helper
    Handlebars.registerHelper('formatDate', function (date, format) {
      if (!date) return ''

      const dateObj = new Date(date)

      // Default format: DD/MM/YYYY
      if (!format) format = 'DD/MM/YYYY'

      const day = dateObj.getDate().toString().padStart(2, '0')
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0')
      const year = dateObj.getFullYear()
      const hours = dateObj.getHours().toString().padStart(2, '0')
      const minutes = dateObj.getMinutes().toString().padStart(2, '0')
      const seconds = dateObj.getSeconds().toString().padStart(2, '0')

      return format
        .replace('DD', day)
        .replace('MM', month)
        .replace('YYYY', year.toString())
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds)
    })

    // Conditional helper
    Handlebars.registerHelper(
      'ifCond',
      function (this: TemplateDelegate, v1, operator, v2, options) {
        switch (operator) {
          case '==':
            return v1 == v2 ? options.fn(this) : options.inverse(this)
          case '===':
            return v1 === v2 ? options.fn(this) : options.inverse(this)
          case '!=':
            return v1 != v2 ? options.fn(this) : options.inverse(this)
          case '!==':
            return v1 !== v2 ? options.fn(this) : options.inverse(this)
          case '<':
            return v1 < v2 ? options.fn(this) : options.inverse(this)
          case '<=':
            return v1 <= v2 ? options.fn(this) : options.inverse(this)
          case '>':
            return v1 > v2 ? options.fn(this) : options.inverse(this)
          case '>=':
            return v1 >= v2 ? options.fn(this) : options.inverse(this)
          case '&&':
            return v1 && v2 ? options.fn(this) : options.inverse(this)
          case '||':
            return v1 || v2 ? options.fn(this) : options.inverse(this)
          default:
            return options.inverse(this)
        }
      }
    )

    // JSON stringify helper
    Handlebars.registerHelper('json', function (context) {
      return JSON.stringify(context)
    })

    // Uppercase helper
    Handlebars.registerHelper('uppercase', function (str) {
      return str.toUpperCase()
    })

    // Lowercase helper
    Handlebars.registerHelper('lowercase', function (str) {
      return str.toLowerCase()
    })

    // Truncate text helper
    Handlebars.registerHelper('truncate', function (str, length) {
      if (str.length > length) {
        return str.substring(0, length) + '...'
      }
      return str
    })
  }

  /**
   * Preload and compile all templates
   */
  private static preloadTemplates(): void {
    try {
      // Get all template files
      const templateFiles = this.getTemplateFiles(this.templatesDir)

      // Compile each template
      for (const file of templateFiles) {
        const templateName = path.basename(file, path.extname(file))
        const templateContent = fs.readFileSync(file, 'utf8')

        try {
          // Compile template and store in map
          const compiledTemplate = Handlebars.compile(templateContent)
          this.compiledTemplates.set(templateName, compiledTemplate)
          logger.debug(`Compiled template: ${templateName}`)
        } catch (compileError) {
          logger.error(`Failed to compile template ${templateName}:`, compileError)
        }
      }

      logger.info(`Preloaded ${this.compiledTemplates.size} templates`)
    } catch (error) {
      logger.error('Failed to preload templates:', error)
    }
  }

  /**
   * Get all template files recursively from directory
   * @param dir Directory to scan for templates
   * @returns Array of template file paths
   */
  private static getTemplateFiles(dir: string): string[] {
    let results: string[] = []

    // Check if directory exists
    if (!fs.existsSync(dir)) {
      return results
    }

    // Get all files in directory
    const files = fs.readdirSync(dir)

    // Process each file
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)

      // If directory, recursively get files
      if (stat.isDirectory()) {
        results = results.concat(this.getTemplateFiles(filePath))
      } else if (
        // If HTML file, add to results
        path.extname(file) === '.html' ||
        path.extname(file) === '.hbs'
      ) {
        results.push(filePath)
      }
    }

    return results
  }

  /**
   * Render a template with data
   * @param templateName Name of the template to render
   * @param data Data to use in the template
   * @returns Rendered HTML string
   */
  static async render(templateName: string, data: Record<string, any> = {}): Promise<string> {
    try {
      // Check if template is already compiled
      let compiledTemplate = this.compiledTemplates.get(templateName)

      // If not compiled, load and compile it
      if (!compiledTemplate) {
        const templatePath = path.join(this.templatesDir, `${templateName}.html`)

        // Check if template file exists
        if (!fs.existsSync(templatePath)) {
          throw new Error(`Template not found: ${templateName}`)
        }

        // Read and compile template
        const templateContent = fs.readFileSync(templatePath, 'utf8')
        compiledTemplate = Handlebars.compile(templateContent)

        // Store compiled template for future use
        this.compiledTemplates.set(templateName, compiledTemplate)
      }

      // Add common data
      const renderData = {
        ...data,
        appName: config.appName || 'PledgePoint',
        appUrl: config.frontend.url,
        logoUrl: config.email.logoUrl,
        year: new Date().getFullYear(),
        footer: config.email.footer,
      }

      // Render template with data
      return compiledTemplate(renderData)
    } catch (error) {
      logger.error(`Failed to render template ${templateName}:`, error)
      throw error
    }
  }

  /**
   * Render a template from a string with data
   * @param templateString Template string to render
   * @param data Data to use in the template
   * @returns Rendered HTML string
   */
  static renderString(templateString: string, data: Record<string, any> = {}): string {
    try {
      // Compile template
      const compiledTemplate = Handlebars.compile(templateString)

      // Add common data
      const renderData = {
        ...data,
        appName: config.appName || 'PledgePoint',
        appUrl: config.frontend.url,
        logoUrl: config.email.logoUrl,
        year: new Date().getFullYear(),
        footer: config.email.footer,
      }

      // Render template with data
      return compiledTemplate(renderData)
    } catch (error) {
      logger.error('Failed to render template string:', error)
      throw error
    }
  }

  /**
   * Creates a new template file
   * @param templateName Name of the template to create
   * @param content Content of the template
   * @returns Promise resolving to true if successful
   */
  static async createTemplate(templateName: string, content: string): Promise<boolean> {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.html`)

      // Check if template already exists
      if (fs.existsSync(templatePath)) {
        throw new Error(`Template already exists: ${templateName}`)
      }

      // Write template file
      fs.writeFileSync(templatePath, content, 'utf8')

      // Compile template and store in map
      const compiledTemplate = Handlebars.compile(content)
      this.compiledTemplates.set(templateName, compiledTemplate)

      logger.info(`Created template: ${templateName}`)
      return true
    } catch (error) {
      logger.error(`Failed to create template ${templateName}:`, error)
      throw error
    }
  }

  /**
   * Updates an existing template file
   * @param templateName Name of the template to update
   * @param content New content of the template
   * @returns Promise resolving to true if successful
   */
  static async updateTemplate(templateName: string, content: string): Promise<boolean> {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.html`)

      // Check if template exists
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templateName}`)
      }

      // Write template file
      fs.writeFileSync(templatePath, content, 'utf8')

      // Compile template and update in map
      const compiledTemplate = Handlebars.compile(content)
      this.compiledTemplates.set(templateName, compiledTemplate)

      logger.info(`Updated template: ${templateName}`)
      return true
    } catch (error) {
      logger.error(`Failed to update template ${templateName}:`, error)
      throw error
    }
  }

  /**
   * Deletes a template file
   * @param templateName Name of the template to delete
   * @returns Promise resolving to true if successful
   */
  static async deleteTemplate(templateName: string): Promise<boolean> {
    try {
      const templatePath = path.join(this.templatesDir, `${templateName}.html`)

      // Check if template exists
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templateName}`)
      }

      // Delete template file
      fs.unlinkSync(templatePath)

      // Remove from compiled templates map
      this.compiledTemplates.delete(templateName)

      logger.info(`Deleted template: ${templateName}`)
      return true
    } catch (error) {
      logger.error(`Failed to delete template ${templateName}:`, error)
      throw error
    }
  }

  /**
   * Get a list of all available templates
   * @returns Array of template names
   */
  static getTemplateList(): string[] {
    try {
      // Get all template files
      const templateFiles = this.getTemplateFiles(this.templatesDir)

      // Extract template names
      return templateFiles.map((file) => path.basename(file, path.extname(file)))
    } catch (error) {
      logger.error('Failed to get template list:', error)
      return []
    }
  }
}
