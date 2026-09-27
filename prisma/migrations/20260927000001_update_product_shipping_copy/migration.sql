UPDATE "Product"
SET "shippingInfo" = 'Orders placed Monday through Friday by 3:30 PM PT (excluding holidays) will ship the same day. Choose UPS Ground or UPS 2nd Day Air at checkout. Shipping is free when the product amount charged to your card is $2,500 or more; otherwise the shipping charge is calculated from your address and selected service.'
WHERE "shippingInfo" LIKE 'Orders placed Monday through Friday by 3:30 PM PT%'
  AND "shippingInfo" LIKE '%UPS Next Day Air%'
  AND "shippingInfo" LIKE '%Orders over $2,000 subtotal receive free shipping%';

UPDATE "Product"
SET "shippingInfo" = 'Orders placed Monday through Friday by 3:30 PM PT (excluding holidays) will ship the same day. Choose UPS Ground or UPS 2nd Day Air at checkout. Shipping is free when the product amount charged to your card is $2,500 or more; otherwise the shipping charge is calculated from your address and selected service. TargetCool products are not eligible for shipping to Alaska and Hawaii.'
WHERE "shippingInfo" LIKE 'Orders placed Monday through Friday by 3:30 PM PT%'
  AND "shippingInfo" LIKE '%Orders over $2,000 subtotal will receive free shipping via UPS Ground%'
  AND "shippingInfo" LIKE '%TargetCool products are not eligible for shipping to Alaska and Hawaii%';
