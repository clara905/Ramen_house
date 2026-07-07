const db = require('../config/db');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

// Helper to query report data
async function queryReportData(type) {
  let data = [];
  
  if (type === 'sales') {
    data = await db.query(
      `SELECT o.id as order_id, o.order_date, o.total_price, o.status, o.name as customer_name, p.payment_method, p.payment_status
       FROM orders o
       LEFT JOIN payments p ON o.id = p.order_id
       ORDER BY o.order_date DESC`
    );
  } else if (type === 'inventory') {
    data = await db.query(
      `SELECT id, name, category, stock, unit, supplier, purchase_price, status, last_updated 
       FROM ingredients 
       ORDER BY name ASC`
    );
  } else if (type === 'revenue') {
    data = await db.query(
      `SELECT DATE_FORMAT(order_date, '%Y-%m-%d') as date, COUNT(id) as total_orders, SUM(total_price) as total_revenue
       FROM orders 
       WHERE status = 'Completed'
       GROUP BY DATE_FORMAT(order_date, '%Y-%m-%d')
       ORDER BY date DESC`
    );
  } else if (type === 'best_selling') {
    data = await db.query(
      `SELECT m.name as menu_name, c.name as category_name, SUM(od.quantity) as total_qty, SUM(od.subtotal) as total_sales
       FROM order_details od
       JOIN menu m ON od.menu_id = m.id
       JOIN categories c ON m.category_id = c.id
       JOIN orders o ON od.order_id = o.id
       WHERE o.status = 'Completed'
       GROUP BY m.id, m.name, c.name
       ORDER BY total_qty DESC`
    );
  } else if (type === 'low_stock') {
    data = await db.query(
      `SELECT id, name, category, stock, unit, supplier, status 
       FROM ingredients 
       WHERE status IN ('Low Stock', 'Out of Stock')
       ORDER BY stock ASC`
    );
  }
  
  return data;
}

// 1. Get Report Data (JSON Preview)
async function getReport(req, res) {
  try {
    const { type } = req.query; // sales, inventory, revenue, best_selling, low_stock
    if (!type) {
      return res.status(400).json({ success: false, message: 'Please specify report type.' });
    }

    const data = await queryReportData(type);
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Get report data error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

// 2. Export Report (PDF or Excel)
async function exportReport(req, res) {
  try {
    const { type, format } = req.query;
    if (!type || !format) {
      return res.status(400).send('Type and format parameters are required.');
    }

    const data = await queryReportData(type);
    const title = type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') + ' Report';

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(title);

      // Define columns depending on data
      if (data.length > 0) {
        const keys = Object.keys(data[0]);
        worksheet.columns = keys.map(key => ({
          header: key.replace('_', ' ').toUpperCase(),
          key: key,
          width: 20
        }));

        data.forEach(item => {
          worksheet.addRow(item);
        });

        // Style the headers
        worksheet.getRow(1).eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'C62828' } // Crimson Theme
          };
        });
      } else {
        worksheet.addRow(['No data available']);
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=ramen_house_${type}_report.xlsx`);
      
      await workbook.xlsx.write(res);
      return res.end();

    } else if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 40 });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=ramen_house_${type}_report.pdf`);
      
      doc.pipe(res);

      // PDF Title Page Header
      doc.fillColor('#C62828').fontSize(24).text('RAMEN HOUSE', { align: 'center' });
      doc.fillColor('#2D2D2D').fontSize(14).text(title, { align: 'center' });
      doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // Draw table or text items
      if (data.length === 0) {
        doc.fontSize(12).text('No records found for this report type.', { align: 'center' });
      } else {
        const keys = Object.keys(data[0]);
        let y = doc.y;

        // Draw headers
        doc.fillColor('#C62828').fontSize(10);
        let xOffset = 40;
        const colWidth = 500 / keys.length;
        
        keys.forEach(key => {
          const colTitle = key.replace('_', ' ').toUpperCase();
          doc.text(colTitle.substring(0, 15), xOffset, y, { width: colWidth, align: 'left' });
          xOffset += colWidth;
        });
        
        doc.moveDown(0.5);
        doc.strokeColor('#CCCCCC').moveTo(40, doc.y).lineTo(540, doc.y).stroke();
        doc.moveDown(0.5);

        // Draw rows
        doc.fillColor('#2D2D2D');
        data.forEach(row => {
          y = doc.y;
          // Check page break
          if (y > 700) {
            doc.addPage();
            y = 40;
          }
          xOffset = 40;
          keys.forEach(key => {
            let val = row[key];
            if (val instanceof Date) {
              val = val.toLocaleDateString();
            } else if (val === null || val === undefined) {
              val = '-';
            } else if (typeof val === 'number') {
              val = val.toString();
            }
            doc.text(val.toString().substring(0, 20), xOffset, y, { width: colWidth, align: 'left' });
            xOffset += colWidth;
          });
          doc.moveDown(0.8);
        });
      }

      doc.end();
    } else {
      return res.status(400).send('Invalid file format. Use "pdf" or "excel".');
    }

  } catch (error) {
    console.error('Export report error:', error);
    return res.status(500).send('Internal server error during export.');
  }
}

module.exports = {
  getReport,
  exportReport
};
